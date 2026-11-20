"""
HIPE (High-resolution Industrial Production Energy) - real per-machine smart-meter data from a
power-electronics production plant (KIT, Germany; CC BY 4.0, https://zenodo.org/records/14054775).

We use the 1-week sample (2017-10-23 .. 2017-10-29): 10 machines + the main terminal, 5 s readings,
aggregated to 15-minute mean power.

  python mlmodel/hipe_pipeline.py extract   raw CSVs (data/hipe/week) -> data/processed/hipe_15min.csv
  python mlmodel/hipe_pipeline.py eval      baseline evaluation -> mlmodel/hipe_results.json

There are NO fault or waste labels in this dataset. So this is a baseline + base-load analysis, not a
detector with measured accuracy. With one week we can only learn a weekday profile (Mon-Tue), calibrate
a threshold (Wed) and test it (Thu-Fri). Weekends are compared against the observed base load.
"""
import glob
import json
import os
import sys
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
RAW_DIR = ROOT / "data" / "hipe" / "week"
CSV_PATH = ROOT / "data" / "processed" / "hipe_15min.csv"
RESULTS = ROOT / "mlmodel" / "hipe_results.json"

INTERVAL_H = 0.25
TRAIN_DAYS = (0, 1)      # Mon, Tue: weekday profile
CALIB_DAY = 2            # Wed: threshold calibration
TEST_DAYS = (3, 4)       # Thu, Fri: held-out weekday test
BASE_PCTL = 10           # base load = this percentile of main power on the training days
IDLE_METERED_KW = 0.5    # "no metered machine running" below this total
TCO2_PER_KWH = 0.0004    # same factor as the steel dataset, only for a rough tCO2 figure


def extract():
    cols = {}
    for f in sorted(glob.glob(str(RAW_DIR / "*.csv"))):
        name = os.path.basename(f).split("_")[0]
        d = pd.read_csv(f, usecols=["SensorDateTime", "P_kW"])
        t = pd.to_datetime(d["SensorDateTime"], utc=True, format="ISO8601")
        d["t"] = t.dt.tz_convert("Europe/Berlin").dt.tz_localize(None)
        cols[name] = d.set_index("t")["P_kW"].resample("15min").mean()
        print(f"  {name}: {len(d)} readings")
    df = pd.DataFrame(cols).clip(lower=0).interpolate(limit=4).fillna(0.0)
    df.index.name = "time"
    CSV_PATH.parent.mkdir(parents=True, exist_ok=True)
    df.round(3).to_csv(CSV_PATH)
    print(f"wrote {CSV_PATH} ({len(df)} intervals)")


def load():
    df = pd.read_csv(CSV_PATH, parse_dates=["time"]).set_index("time")
    machines = [c for c in df.columns if c != "MainTerminal"]
    df["metered_kw"] = df[machines].sum(axis=1)
    df["dow"] = df.index.dayofweek
    df["slot"] = df.index.hour * 4 + df.index.minute // 15
    return df, machines


def fit(df):
    """Weekday profile by 15-min slot (Mon-Tue), base load, and a threshold calibrated on Wed."""
    train = df[df["dow"].isin(TRAIN_DAYS)]
    profile = train.groupby("slot")["MainTerminal"].mean()
    base_kw = float(np.percentile(train["MainTerminal"], BASE_PCTL))
    calib = df[df["dow"] == CALIB_DAY]
    resid = calib["MainTerminal"].values - profile.reindex(calib["slot"]).values
    thr = float(np.percentile(np.abs(resid), 95))
    return {"profile": profile, "base_kw": base_kw, "threshold_kw": thr}


def expected(df, model):
    """Expected main power: weekday profile on weekdays, observed base load on weekends."""
    exp = model["profile"].reindex(df["slot"]).values
    weekend = df["dow"].values >= 5
    return np.where(weekend, model["base_kw"], exp)


def evaluate():
    df, machines = load()
    model = fit(df)
    exp = expected(df, model)
    df = df.assign(expected_kw=exp)

    test = df[df["dow"].isin(TEST_DAYS)]
    y, p = test["MainTerminal"].values, test["expected_kw"].values
    mae = float(np.mean(np.abs(y - p)))
    mape = float(np.mean(np.abs(y - p) / np.maximum(y, 1e-6)) * 100)
    naive = float(np.mean(np.abs(y - df[df["dow"].isin(TRAIN_DAYS)]["MainTerminal"].mean())))
    flagged = float(np.mean(y > p + model["threshold_kw"]) * 100)

    weekend = df[df["dow"] >= 5]
    wk_kwh = float(df["MainTerminal"].sum() * INTERVAL_H)
    base_kwh = float(len(df) * INTERVAL_H * model["base_kw"])
    idle = df[df["metered_kw"] < IDLE_METERED_KW]
    metered_kwh = float(df["metered_kw"].sum() * INTERVAL_H)

    res = {
        "dataset": "HIPE one-week sample (2017-10-23..29), 10 machines + main terminal",
        "intervals": int(len(df)),
        "split": {"profile_days": "Mon-Tue", "threshold_day": "Wed", "test_days": "Thu-Fri"},
        "base_load_kw": round(model["base_kw"], 2),
        "threshold_kw": round(model["threshold_kw"], 2),
        "heldout_weekday": {
            "mae_kw": round(mae, 2), "mape_pct": round(mape, 1),
            "naive_mean_mae_kw": round(naive, 2),
            "flagged_pct": round(flagged, 1),
        },
        "weekend_mean_kw": round(float(weekend["MainTerminal"].mean()), 2),
        "total_kwh": round(wk_kwh, 1),
        "base_load_kwh": round(base_kwh, 1),
        "base_load_share_pct": round(base_kwh / wk_kwh * 100, 1),
        "metered_machine_kwh": round(metered_kwh, 1),
        "metered_machine_share_pct": round(metered_kwh / wk_kwh * 100, 1),
        "idle_interval_pct": round(len(idle) / len(df) * 100, 1),
        "notes": [
            "No fault or waste labels exist, so flags are unvalidated.",
            "One week only: the weekday profile uses 2 days, and no weekend day is available for learning.",
            "About 96% of plant energy is not covered by the 10 sub-metered machines.",
        ],
    }
    RESULTS.write_text(json.dumps(res, indent=2))
    print(json.dumps(res, indent=2))


def build_stream(df=None, model=None):
    """Rows for the websocket replay: one dict per 15-minute interval."""
    if df is None:
        df, machines = load()
    else:
        machines = [c for c in df.columns if c not in ("MainTerminal", "metered_kw", "dow", "slot")]
    if model is None:
        model = fit(df)
    exp = expected(df, model)
    rows, cum_kwh, cum_base, cum_idle = [], 0.0, 0.0, 0.0
    total = len(df)
    for i, (t, r) in enumerate(df.iterrows()):
        main = float(r["MainTerminal"])
        kwh = main * INTERVAL_H
        cum_kwh += kwh
        cum_base += min(main, model["base_kw"]) * INTERVAL_H
        idle = bool(r["metered_kw"] < IDLE_METERED_KW)
        if idle:
            cum_idle += kwh
        rows.append({
            "type": "hipe", "index": i, "total": total, "time": t.strftime("%Y-%m-%d %H:%M"),
            "weekday": t.strftime("%a"),
            "main_kw": round(main, 2), "metered_kw": round(float(r["metered_kw"]), 2),
            "unmetered_kw": round(max(0.0, main - float(r["metered_kw"])), 2),
            "expected_kw": round(float(exp[i]), 2), "base_kw": round(model["base_kw"], 2),
            "threshold_kw": round(model["threshold_kw"], 2),
            "high": bool(main > exp[i] + model["threshold_kw"]),
            "idle": idle,
            "machines": {m: round(float(r[m]), 2) for m in machines},
            "cum_kwh": round(cum_kwh, 1), "cum_base_kwh": round(cum_base, 1),
            "cum_idle_kwh": round(cum_idle, 1), "cum_tco2": round(cum_kwh * TCO2_PER_KWH, 3),
        })
    return rows


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else "eval"
    {"extract": extract, "eval": evaluate}[cmd]()
