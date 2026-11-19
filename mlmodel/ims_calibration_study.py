"""
Per-machine calibration study for the IMS bearing detector.

Each bearing is calibrated only from its OWN healthy baseline (first `base_frac` of the run):
  - baseline split: first 60% = fit (scaler + PCA), last 40% = calibration
  - threshold = q-th percentile of calibration errors * margin
  - alarm = 3 consecutive snapshots above threshold
No failure labels are used to set the threshold.

Compared against the earlier method (threshold from training error: mean + 6 std, 25% baseline).
Healthy-reference region for false alarms: snapshots 40%..50% of every run (same for all configs).

Leave-one-test-out: choose config on the other two tests (rule fixed in advance), score the third.

Usage (from CarbonEdge/):  python mlmodel/ims_calibration_study.py
"""
import sys
import json
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.preprocessing import StandardScaler
from sklearn.decomposition import PCA

sys.path.insert(0, str(Path(__file__).resolve().parent))
from ims_multi_eval import TESTS, OUT, run_bearing  # noqa: E402
from ims_pipeline import prep, recon_error, FEATURE_COLS  # noqa: E402

BASE_FRACS = [0.15, 0.25, 0.40]
QS = [99.0, 99.9, 100.0]
MARGINS = [1.0, 1.5, 2.0]
M = 3
FA_LIMIT = 0.005
FIT_SHARE = 0.6
HEALTHY_REF = (0.40, 0.50)


def load():
    data = {}
    for test, cfg in TESTS.items():
        df = pd.read_csv(OUT / f"ims_{test}_features.csv")
        t = pd.to_datetime(df["time"])
        for b in cfg["bearing_cols"]:
            cols = {c: f"b{b}_{c}" for c in FEATURE_COLS}
            sub = df[list(cols.values())].rename(columns={v: k for k, v in cols.items()})
            data[(test, b)] = dict(test=test, bearing=b, failed=b in cfg["failing"],
                                   X=prep(sub), t=t)
    return data


def calibrated_alarm(run, base_frac, q, margin):
    X = run["X"]
    n = int(len(X) * base_frac)
    fit_n = int(n * FIT_SHARE)
    scaler = StandardScaler().fit(X[:fit_n])
    pca = PCA(n_components=3).fit(scaler.transform(X[:fit_n]))
    err = recon_error(scaler, pca, X)
    thr = np.percentile(err[fit_n:n], q) * margin
    flag = err > thr
    alarm = pd.Series(flag).rolling(M).sum().fillna(0).values >= M
    return alarm, n


def baseline_alarm(run):
    """The earlier method: threshold from training error, mean + 6 std, 25% baseline."""
    X = run["X"]
    n = int(len(X) * 0.25)
    scaler = StandardScaler().fit(X[:n])
    pca = PCA(n_components=3).fit(scaler.transform(X[:n]))
    err = recon_error(scaler, pca, X)
    thr = err[:n].mean() + 6 * err[:n].std()
    return pd.Series(err > thr).rolling(M).sum().fillna(0).values >= M, n


def score(run, alarm, n):
    L = len(alarm)
    lo, hi = int(L * HEALTHY_REF[0]), int(L * HEALTHY_REF[1])
    held = alarm[n:]
    first = int(np.argmax(held)) + n if held.any() else None
    return dict(
        fa_ref=float(alarm[lo:hi].mean()),
        overall=float(held.mean()),
        detected=first is not None,
        lead_h=float((run["t"].iloc[-1] - run["t"].iloc[first]).total_seconds() / 3600) if first is not None else None,
    )


def summarize(runs, fn):
    rows = [score(r, *fn(r)) for r in runs]
    fail = [s for r, s in zip(runs, rows) if r["failed"]]
    ctrl = [s for r, s in zip(runs, rows) if not r["failed"]]
    leads = [s["lead_h"] for s in fail if s["lead_h"] is not None]
    return dict(
        failures_detected=sum(s["detected"] for s in fail), failures_total=len(fail),
        mean_fa_ref=float(np.mean([s["fa_ref"] for s in rows])),
        max_fa_ref=float(np.max([s["fa_ref"] for s in rows])),
        controls_quiet=sum(s["overall"] <= 0.01 for s in ctrl), controls_total=len(ctrl),
        median_lead_h=float(np.median(leads)) if leads else None,
    )


def config_fn(cfg):
    return lambda r: calibrated_alarm(r, cfg["base_frac"], cfg["q"], cfg["margin"])


def main():
    data = load()
    runs = list(data.values())
    configs = [dict(base_frac=bf, q=q, margin=mg) for bf in BASE_FRACS for q in QS for mg in MARGINS]

    old = summarize(runs, baseline_alarm)
    print("== Earlier method (mean+6std on training error, 25% baseline), all 12 runs ==")
    print({k: (round(v, 4) if isinstance(v, float) else v) for k, v in old.items()})

    grid = []
    for c in configs:
        grid.append({**c, **summarize(runs, config_fn(c))})
    g = pd.DataFrame(grid)
    print("\n== Calibration grid (all 12 runs) ==")
    print(g.round(4).to_string(index=False))

    print("\n== Leave-one-test-out (config chosen on the other two tests) ==")
    loto, tot_det, tot_fail = [], 0, 0
    for held in TESTS:
        sel = [r for r in runs if r["test"] != held]
        tst = [r for r in runs if r["test"] == held]
        cands = [{**c, **summarize(sel, config_fn(c))} for c in configs]
        ok = [c for c in cands if c["max_fa_ref"] <= FA_LIMIT] or cands
        best = sorted(ok, key=lambda c: (c["failures_detected"], c["margin"], c["q"], -c["base_frac"]))[-1]
        res = summarize(tst, config_fn(best))
        res.update(held_out=held, chosen=dict(base_frac=best["base_frac"], q=best["q"], margin=best["margin"]))
        loto.append(res)
        tot_det += res["failures_detected"]; tot_fail += res["failures_total"]
        print(f"held-out {held}: chose {res['chosen']} -> detected {res['failures_detected']}/{res['failures_total']}, "
              f"max FA in healthy ref {res['max_fa_ref']:.3%}, controls quiet {res['controls_quiet']}/{res['controls_total']}, "
              f"median lead {res['median_lead_h']}")
    print(f"TOTAL leave-one-test-out: {tot_det}/{tot_fail} failures detected")

    old_loto = [summarize([r for r in runs if r["test"] == t], baseline_alarm) for t in TESTS]
    print("\nEarlier method per test, same healthy-ref FA metric (max FA):",
          [round(o["max_fa_ref"], 4) for o in old_loto])

    g.to_csv(OUT / "ims_calibration_grid.csv", index=False)
    (Path(__file__).resolve().parent / "ims_calibration_study.json").write_text(
        json.dumps(dict(earlier_method=old, grid=grid, leave_one_test_out=loto), indent=2, default=float))


if __name__ == "__main__":
    main()
