"""
HIPE (High-resolution Industrial Production Energy) - real per-machine smart-meter data from a
power-electronics production plant (KIT, Germany; CC BY 4.0, https://zenodo.org/records/14054775).
Dataset paper: https://doi.org/10.1145/3208903.3210278

Full 3-month set (2017-10-01 .. 2017-12-31): 10 machines + the main terminal, 5 s readings, aggregated to
15-minute mean power. The 1.3 GB zip is streamed (never fully extracted: it is ~28 GB of CSV).

  python mlmodel/hipe_pipeline.py extract   data/hipe/hipe_full.zip -> data/processed/hipe_15min.csv
  python mlmodel/hipe_pipeline.py eval      baseline evaluation     -> mlmodel/hipe_results.json

There are NO fault or waste labels. This is a baseline + base-load analysis, not a detector with measured
accuracy. Splits are by date (no shuffling):
  profile : 2017-10-01 .. 2017-11-25  (8 weeks)  median power per (weekday, 15-min slot), base load
  calibrate: 2017-11-26 .. 2017-12-09  (2 weeks) alert threshold
  test    : 2017-12-10 .. 2017-12-31  (3 weeks)  held-out, includes Christmas / New Year
"""
import json
import sys
import zipfile
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
ZIP_PATH = ROOT / "data" / "hipe" / "hipe_full.zip"
CSV_PATH = ROOT / "data" / "processed" / "hipe_15min.csv"
RESULTS = ROOT / "mlmodel" / "hipe_results.json"

INTERVAL_H = 0.25
PROFILE_END = pd.Timestamp("2017-11-26")   # exclusive
CALIB_END = pd.Timestamp("2017-12-10")     # exclusive
BASE_PCTL = 10           # base load = this percentile of main power on the profile period
IDLE_METERED_KW = 0.5    # "no metered machine running" below this total
TCO2_PER_KWH = 0.0004    # same factor as the steel dataset, only for a rough tCO2 figure
# German public holidays / bridge days in the test window (assumption; the plant is in Baden-Wuerttemberg)
TEST_HOLIDAYS = {"2017-12-24", "2017-12-25", "2017-12-26", "2017-12-31"}


def extract(zip_path=ZIP_PATH):
    sums, counts = {}, {}
    with zipfile.ZipFile(zip_path) as zf:
        members = sorted(n for n in zf.namelist() if n.endswith(".csv"))
        for name in members:
            machine = Path(name).name.split("_")[0]
            s_tot = pd.Series(dtype="float64")
            c_tot = pd.Series(dtype="float64")
            with zf.open(name) as fh:
                for chunk in pd.read_csv(fh, usecols=["SensorDateTime", "P_kW"], chunksize=1_000_000):
                    t = pd.to_datetime(chunk["SensorDateTime"], utc=True, format="ISO8601")
                    t = t.dt.tz_convert("Europe/Berlin").dt.tz_localize(None).dt.floor("15min")
                    g = chunk["P_kW"].groupby(t.values)
                    s_tot = s_tot.add(g.sum(), fill_value=0.0)
                    c_tot = c_tot.add(g.count(), fill_value=0.0)
            sums[machine], counts[machine] = s_tot, c_tot
            print(f"  {machine}: {int(c_tot.sum())} readings", flush=True)
    df = pd.DataFrame({m: sums[m] / counts[m].replace(0, np.nan) for m in sums}).sort_index()
    df = df.reindex(pd.date_range(df.index.min(), df.index.max(), freq="15min"))
    df.index.name = "time"
    missing = int(df["MainTerminal"].isna().sum())
    df = df.clip(lower=0).interpolate(limit=8).fillna(0.0)
    CSV_PATH.parent.mkdir(parents=True, exist_ok=True)
    df.round(3).to_csv(CSV_PATH)
    print(f"wrote {CSV_PATH} ({len(df)} intervals, {missing} main-meter gaps filled)")


def load():
    df = pd.read_csv(CSV_PATH, parse_dates=["time"]).set_index("time")
    machines = [c for c in df.columns if c != "MainTerminal"]
    df["metered_kw"] = df[machines].sum(axis=1)
    df["dow"] = df.index.dayofweek
    df["slot"] = df.index.hour * 4 + df.index.minute // 15
    df["wslot"] = df["dow"] * 96 + df["slot"]
    df["split"] = np.where(df.index < PROFILE_END, "profile", np.where(df.index < CALIB_END, "calibration", "test"))
    return df, machines


def fit(df):
    """Median profile per (weekday, 15-min slot) over the profile weeks, base load, calibrated threshold."""
    prof = df[df["split"] == "profile"]
    profile = prof.groupby("wslot")["MainTerminal"].median()
    base_kw = float(np.percentile(prof["MainTerminal"], BASE_PCTL))
    calib = df[df["split"] == "calibration"]
    resid = calib["MainTerminal"].values - profile.reindex(calib["wslot"]).values
    thr = float(np.percentile(resid, 95))
    return {"profile": profile, "base_kw": base_kw, "threshold_kw": max(thr, 1.0)}


def expected(df, model):
    return model["profile"].reindex(df["wslot"]).values


def _mae(y, p):
    return float(np.mean(np.abs(y - p)))


def evaluate():
    df, machines = load()
    model = fit(df)
    df = df.assign(expected_kw=expected(df, model))
    test = df[df["split"] == "test"]
    day = test.index.strftime("%Y-%m-%d")
    hol = np.isin(day, list(TEST_HOLIDAYS))
    normal = test[~hol]
    hols = test[hol]

    # simple reference models on the same test intervals
    prof_mean = float(df[df["split"] == "profile"]["MainTerminal"].mean())
    last_week = df["MainTerminal"].shift(672).loc[test.index]
    ok_lw = ~last_week.isna()

    def stats(sub):
        y, p = sub["MainTerminal"].values, sub["expected_kw"].values
        return {
            "intervals": int(len(sub)),
            "mae_kw": round(_mae(y, p), 2),
            "mape_pct": round(float(np.mean(np.abs(y - p) / np.maximum(y, 1.0)) * 100), 1),
            "naive_mean_mae_kw": round(_mae(y, prof_mean), 2),
            "flagged_pct": round(float(np.mean(y > p + model["threshold_kw"]) * 100), 1),
        }

    t_normal = stats(normal)
    t_normal["last_week_same_slot_mae_kw"] = round(_mae(normal["MainTerminal"].values, last_week.loc[normal.index].values), 2)
    t_hol = stats(hols)

    wk_kwh = float(df["MainTerminal"].sum() * INTERVAL_H)
    base_kwh = float(np.minimum(df["MainTerminal"], model["base_kw"]).sum() * INTERVAL_H)
    metered_kwh = float(df["metered_kw"].sum() * INTERVAL_H)
    idle = df["metered_kw"] < IDLE_METERED_KW
    per_machine = (df[machines].sum() * INTERVAL_H).round(1).sort_values(ascending=False)
    weekend = df[df["dow"] >= 5]

    res = {
        "dataset": "HIPE full set (2017-10-01..12-31), 10 machines + main terminal, 15-min means",
        "intervals": int(len(df)),
        "split": {"profile": "Oct 1 - Nov 25 (8 wk)", "calibration": "Nov 26 - Dec 9 (2 wk)", "test": "Dec 10 - Dec 31 (3 wk)"},
        "holidays_in_test": sorted(TEST_HOLIDAYS),
        "base_load_kw": round(model["base_kw"], 2),
        "threshold_kw": round(model["threshold_kw"], 2),
        "heldout_normal_days": t_normal,
        "heldout_holidays": t_hol,
        "weekend_mean_kw": round(float(weekend["MainTerminal"].mean()), 2),
        "total_kwh": round(wk_kwh, 1),
        "base_load_kwh": round(base_kwh, 1),
        "base_load_share_pct": round(base_kwh / wk_kwh * 100, 1),
        "metered_machine_kwh": round(metered_kwh, 1),
        "metered_machine_share_pct": round(metered_kwh / wk_kwh * 100, 1),
        "idle_interval_pct": round(float(idle.mean() * 100), 1),
        "idle_energy_share_pct": round(float(df.loc[idle, "MainTerminal"].sum() * INTERVAL_H / wk_kwh * 100), 1),
        "kwh_by_machine": {k: float(v) for k, v in per_machine.items()},
        "notes": [
            "No fault or waste labels exist, so flags are unvalidated.",
            "Holiday days in the test window are an assumption (German public holidays); the profile cannot know about them.",
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
        machines = [c for c in df.columns if c not in ("MainTerminal", "metered_kw", "dow", "slot", "wslot", "split")]
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
            "weekday": t.strftime("%a"), "split": str(r["split"]),
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
