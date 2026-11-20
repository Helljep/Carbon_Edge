"""
Evaluate the energy baselines on YOUR OWN power data, with the same honest method used for HIPE.

  python mlmodel/evaluate_csv.py my_meter.csv --time-col timestamp --main-col power_kw

Input: a CSV with a timestamp column and a power column in kW (any sampling rate: it is averaged to
15-minute intervals). Extra columns can be given with --machine-cols for sub-metered machines.
Needs at least about 4 weeks of data (2 weeks of history are needed before the baseline can predict).

Splits are chronological, never shuffled: first 60% profile, next 15% calibration, last 25% held-out test.
The baseline is chosen on the calibration part only. No fault/waste labels are used or needed, so the
output is a baseline error and a base-load analysis, not a detection accuracy.
"""
import argparse
import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent))
import hipe_pipeline as hp  # noqa: E402  (reuses candidates() / fit())

MIN_DAYS = 28


def prepare(csv, time_col, main_col, machine_cols, tz):
    raw = pd.read_csv(csv)
    t = pd.to_datetime(raw[time_col], utc=True, format="ISO8601", errors="coerce")
    if t.isna().all():
        raise SystemExit(f"Could not parse any timestamps in column '{time_col}'")
    raw = raw.assign(_t=t.dt.tz_convert(tz).dt.tz_localize(None)).dropna(subset=["_t"])
    cols = {main_col: "MainTerminal", **{c: c for c in machine_cols}}
    df = raw.set_index("_t")[list(cols)].apply(pd.to_numeric, errors="coerce").rename(columns=cols)
    df = df.resample("15min").mean()
    gaps = int(df["MainTerminal"].isna().sum())
    df = df.clip(lower=0).interpolate(limit=8).fillna(0.0)
    df.index.name = "time"
    return df, gaps


def split(df):
    n = len(df)
    a, b = int(n * 0.60), int(n * 0.75)
    df = df.copy()
    machines = [c for c in df.columns if c != "MainTerminal"]
    df["metered_kw"] = df[machines].sum(axis=1) if machines else 0.0
    df["dow"] = df.index.dayofweek
    df["slot"] = df.index.hour * 4 + df.index.minute // 15
    df["wslot"] = df["dow"] * 96 + df["slot"]
    df["split"] = ["profile"] * a + ["calibration"] * (b - a) + ["test"] * (n - b)
    return df


def run(csv, time_col, main_col, machine_cols, tz, out=None):
    df, gaps = prepare(csv, time_col, main_col, machine_cols, tz)
    days = (df.index.max() - df.index.min()).days
    if days < MIN_DAYS:
        raise SystemExit(f"Only {days} days of data; need at least {MIN_DAYS} for a meaningful evaluation.")
    df = split(df)
    model = hp.fit(df)
    cands = hp.candidates(df, model["profile"])
    y = df["MainTerminal"].values
    test = (df["split"] == "test").values
    res = {
        "file": str(csv), "days": days, "intervals": int(len(df)), "gaps_filled": gaps,
        "split": {s: int((df["split"] == s).sum()) for s in ("profile", "calibration", "test")},
        "selected_baseline": model["baseline"],
        "baseline_comparison": {
            k: {"calibration_mae_kw": round(model["calibration_mae"][k], 3),
                "test_mae_kw": round(float(np.mean(np.abs(y[test] - v[test]))), 3)}
            for k, v in cands.items()
        },
        "naive_mean_test_mae_kw": round(float(np.mean(np.abs(y[test] - y[(df["split"] == "profile").values].mean()))), 3),
        "alert_threshold_kw": round(model["threshold_kw"], 2),
        "test_flagged_pct": round(float(np.mean(y[test] > cands[model["baseline"]][test] + model["threshold_kw"]) * 100), 1),
        "base_load_kw": round(model["base_kw"], 2),
        "base_load_share_pct": round(float(np.minimum(y, model["base_kw"]).sum() / max(y.sum(), 1e-9) * 100), 1),
        "total_kwh": round(float(y.sum() * hp.INTERVAL_H), 1),
        "note": "No labels: this is baseline error and base-load analysis, not detection accuracy.",
    }
    if out:
        Path(out).write_text(json.dumps(res, indent=2))
    print(json.dumps(res, indent=2))
    return res


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("csv")
    ap.add_argument("--time-col", default="timestamp")
    ap.add_argument("--main-col", default="power_kw")
    ap.add_argument("--machine-cols", nargs="*", default=[])
    ap.add_argument("--tz", default="UTC", help="timezone for hour/weekday features, e.g. Asia/Kolkata")
    ap.add_argument("--out", default=None, help="write the JSON report here")
    a = ap.parse_args()
    run(a.csv, a.time_col, a.main_col, a.machine_cols, a.tz, a.out)
