"""
Threshold sensitivity study for the IMS bearing detector.

1. Full grid: alarm threshold = mean + k*std (training error), alarm = m consecutive flags.
2. Leave-one-test-out: choose (k, m) using the OTHER two tests, score the held-out test.
   Selection rule (fixed in advance): among settings whose mean first-half held-out
   false-alarm rate on the selection tests is <= 0.5%, pick the one detecting the most
   failed bearings; ties -> larger k, then larger m (more conservative).

Usage (from CarbonEdge/):  python mlmodel/ims_threshold_study.py
"""
import sys
import json
from pathlib import Path

import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent))
from ims_multi_eval import TESTS, OUT, run_bearing  # noqa: E402

KS = [2, 3, 4, 5, 6, 8, 10]
MS = [1, 3, 5]
FA_LIMIT = 0.005


def alarm_from(err, n_train, k, m):
    thr = err[:n_train].mean() + k * err[:n_train].std()
    flag = err > thr
    return pd.Series(flag).rolling(m).sum().fillna(0).values >= m


def build_runs():
    runs = []
    for test, cfg in TESTS.items():
        df = pd.read_csv(OUT / f"ims_{test}_features.csv")
        t = pd.to_datetime(df["time"])
        for b in cfg["bearing_cols"]:
            err, _, n_train = run_bearing(df, b)
            runs.append(dict(test=test, bearing=b, failed=b in cfg["failing"],
                             err=err, n_train=n_train, t=t))
    return runs


def score(run, k, m):
    err, n = run["err"], run["n_train"]
    alarm = alarm_from(err, n, k, m)
    held = alarm[n:]
    first = int(np.argmax(held)) + n if held.any() else None
    return dict(
        fa_first_half=float(alarm[n:len(err) // 2].mean()),
        overall=float(held.mean()),
        detected=first is not None,
        lead_h=float((run["t"].iloc[-1] - run["t"].iloc[first]).total_seconds() / 3600) if first is not None else None,
    )


def summarize(runs, k, m):
    rows = [score(r, k, m) for r in runs]
    fail = [(r, s) for r, s in zip(runs, rows) if r["failed"]]
    ctrl = [(r, s) for r, s in zip(runs, rows) if not r["failed"]]
    return dict(
        k=k, m=m,
        failures_detected=sum(s["detected"] for _, s in fail), failures_total=len(fail),
        mean_fa_first_half=float(np.mean([s["fa_first_half"] for s in rows])),
        controls_quiet=sum(s["overall"] <= 0.01 for _, s in ctrl), controls_total=len(ctrl),
        median_lead_h=float(np.median([s["lead_h"] for _, s in fail if s["lead_h"] is not None])) if any(s["detected"] for _, s in fail) else None,
    )


def main():
    runs = build_runs()
    grid = pd.DataFrame([summarize(runs, k, m) for k in KS for m in MS])
    print("== Full grid (all 12 bearing runs) ==")
    print(grid.round(4).to_string(index=False))

    print("\n== Leave-one-test-out ==")
    loto = []
    for held in TESTS:
        sel = [r for r in runs if r["test"] != held]
        tst = [r for r in runs if r["test"] == held]
        cands = [summarize(sel, k, m) for k in KS for m in MS]
        ok = [c for c in cands if c["mean_fa_first_half"] <= FA_LIMIT] or cands
        best = sorted(ok, key=lambda c: (c["failures_detected"], c["k"], c["m"]))[-1]
        res = summarize(tst, best["k"], best["m"])
        res.update(held_out=held, chosen_on="other two tests")
        loto.append(res)
        print(f"held-out {held}: chose k={best['k']}, m={best['m']} -> "
              f"detected {res['failures_detected']}/{res['failures_total']} failures, "
              f"first-half FA {res['mean_fa_first_half']:.3%}, "
              f"controls quiet {res['controls_quiet']}/{res['controls_total']}, "
              f"median lead {res['median_lead_h']}")

    # the per-bearing detail for the missed failure across the grid
    miss = next(r for r in runs if r["test"] == "3rd_test" and r["bearing"] == 3)
    print("\n== 3rd_test bearing 3 (the miss) across k (m=3) ==")
    for k in KS:
        s = score(miss, k, 3)
        print(f"k={k:>2}: detected={s['detected']}  lead={s['lead_h']}  first-half FA={s['fa_first_half']:.3%}  overall alarm={s['overall']:.3%}")

    grid.to_csv(OUT / "ims_threshold_grid.csv", index=False)
    (Path(__file__).resolve().parent / "ims_threshold_study.json").write_text(
        json.dumps({"grid": grid.to_dict("records"), "leave_one_test_out": loto}, indent=2, default=float))


if __name__ == "__main__":
    main()
