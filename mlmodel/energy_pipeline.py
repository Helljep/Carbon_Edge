"""
Plant-level energy baselining on the UCI Steel Industry Energy Consumption data
(one steel plant, South Korea, 2018, 15-minute readings).

IMPORTANT honesty notes
  - There are NO fault/waste labels in this dataset, so this is baselining, not validated detection.
  - CO2(tCO2) is derived from Usage_kWh (corr ~0.99, ~0.0004 tCO2/kWh); it adds no independent signal.
  - Load_Type is derived from Usage_kWh, so it is NOT used as a model input (would leak the answer).

Method: expected-usage model from calendar features only (time of day, weekday/weekend, day of week),
trained on Jan-Aug, calibrated on Sep, tested on Oct-Dec. Intervals whose actual usage exceeds the
expected value by more than the 99th percentile of the calibration residual are flagged "unexpectedly high".

Usage (from CarbonEdge/):  python mlmodel/energy_pipeline.py
"""
import json
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.ensemble import HistGradientBoostingRegressor
from sklearn.metrics import mean_absolute_error

ROOT = Path(__file__).resolve().parent.parent
CSV = ROOT / "data" / "steel" / "Steel_industry_data.csv"
OUT = ROOT / "data" / "processed"

DOW = {"Monday": 0, "Tuesday": 1, "Wednesday": 2, "Thursday": 3, "Friday": 4, "Saturday": 5, "Sunday": 6}


def load():
    d = pd.read_csv(CSV, encoding="utf-8-sig")
    d["date"] = pd.to_datetime(d["date"], format="%d/%m/%Y %H:%M")
    d = d.sort_values("date").reset_index(drop=True)
    d["dow"] = d["Day_of_week"].map(DOW)
    d["weekend"] = (d["WeekStatus"] == "Weekend").astype(int)
    d["month"] = d["date"].dt.month
    return d


FEATS = ["NSM", "dow", "weekend"]


def main():
    d = load()
    train = d[d.month <= 8]
    cal = d[d.month == 9]
    test = d[d.month >= 10].copy()

    model = HistGradientBoostingRegressor(max_iter=200, learning_rate=0.08, random_state=0)
    model.fit(train[FEATS], train["Usage_kWh"])

    cal_res = cal["Usage_kWh"].values - model.predict(cal[FEATS])
    thr = float(np.percentile(cal_res, 99))
    test["expected"] = model.predict(test[FEATS])
    test["excess"] = test["Usage_kWh"] - test["expected"]
    test["high"] = test["excess"] > thr

    naive = np.full(len(test), train["Usage_kWh"].mean())
    res = {
        "rows": len(d),
        "period": [str(d.date.min()), str(d.date.max())],
        "total_kWh": float(d.Usage_kWh.sum()),
        "total_tCO2": float(d["CO2(tCO2)"].sum()),
        "implied_tCO2_per_kWh": float(d["CO2(tCO2)"].sum() / d.Usage_kWh.sum()),
        "corr_kWh_CO2": float(d.Usage_kWh.corr(d["CO2(tCO2)"])),
        "share_active_intervals_lagging_PF_below_90": float(
            ((d.Lagging_Current_Power_Factor < 90) & (d.Usage_kWh > 1)).sum() / (d.Usage_kWh > 1).sum()),
        "heldout_months": "Oct-Dec",
        "heldout_MAE_model": float(mean_absolute_error(test.Usage_kWh, test.expected)),
        "heldout_MAE_naive_mean": float(mean_absolute_error(test.Usage_kWh, naive)),
        "high_threshold_kWh": thr,
        "heldout_share_flagged_high": float(test.high.mean()),
        "heldout_excess_kWh_flagged": float(test.loc[test.high, "excess"].sum()),
        "heldout_total_kWh": float(test.Usage_kWh.sum()),
    }
    res["heldout_excess_share_of_total"] = res["heldout_excess_kWh_flagged"] / res["heldout_total_kWh"]
    for k, v in res.items():
        print(f"{k}: {v:.4f}" if isinstance(v, float) else f"{k}: {v}")

    OUT.mkdir(parents=True, exist_ok=True)
    test[["date", "Usage_kWh", "CO2(tCO2)", "expected", "excess", "high"]].to_csv(OUT / "energy_heldout.csv", index=False)
    (Path(__file__).resolve().parent / "energy_results.json").write_text(json.dumps(res, indent=2))


if __name__ == "__main__":
    main()
