"""
Multi-test evaluation of the bearing anomaly detector on all three NASA IMS tests.

For every bearing in every test we train an independent model on that bearing's own
first 25% of snapshots (time-based split) and score the whole run.

  failing bearings (per the NASA readme):  1st_test b3 (inner race), b4 (roller),
                                           2nd_test b1 (outer race), 3rd_test b3 (outer race)
  control bearings (no reported failure):  everything else - these should NOT alarm

Usage (from CarbonEdge/):
  python mlmodel/ims_multi_eval.py extract
  python mlmodel/ims_multi_eval.py eval
"""
import sys
import json
from datetime import datetime
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.preprocessing import StandardScaler
from sklearn.decomposition import PCA

sys.path.insert(0, str(Path(__file__).resolve().parent))
from ims_pipeline import features, prep, recon_error, FEATURE_COLS, TRAIN_FRAC  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
IMS = ROOT / "data" / "ims"
OUT = ROOT / "data" / "processed"

# test -> (folder, last documented file, channel column index for each bearing, failing bearings)
TESTS = {
    "1st_test": dict(folder=IMS / "1st_test" / "1st_test", last="2003.11.25.23.39.56",
                     bearing_cols={1: 0, 2: 2, 3: 4, 4: 6},
                     failing={3: "inner race", 4: "roller element"}),
    "2nd_test": dict(folder=IMS / "2nd_test" / "2nd_test", last="2004.02.19.06.22.39",
                     bearing_cols={1: 0, 2: 1, 3: 2, 4: 3},
                     failing={1: "outer race"}),
    "3rd_test": dict(folder=IMS / "3rd_test" / "4th_test" / "txt", last="2004.04.04.19.01.57",
                     bearing_cols={1: 0, 2: 1, 3: 2, 4: 3},
                     failing={3: "outer race"}),
}


def ts(name):
    return datetime.strptime(name, "%Y.%m.%d.%H.%M.%S")


def extract(test):
    cfg = TESTS[test]
    OUT.mkdir(parents=True, exist_ok=True)
    files = sorted(p for p in cfg["folder"].iterdir() if p.is_file() and p.name <= cfg["last"])
    print(f"{test}: {len(files)} documented snapshots", flush=True)
    rows = []
    for i, p in enumerate(files):
        arr = pd.read_csv(p, sep="\t", header=None).values
        row = {"file": p.name, "time": ts(p.name).isoformat()}
        for b, col in cfg["bearing_cols"].items():
            for k, v in features(arr[:, col]).items():
                row[f"b{b}_{k}"] = v
        rows.append(row)
        if i % 250 == 0:
            print(f"  {test} {i}/{len(files)}", flush=True)
    pd.DataFrame(rows).to_csv(OUT / f"ims_{test}_features.csv", index=False)
    print("saved", test, flush=True)


def run_bearing(df, b):
    cols = {c: f"b{b}_{c}" for c in FEATURE_COLS}
    sub = df[list(cols.values())].rename(columns={v: k for k, v in cols.items()})
    X = prep(sub)
    n_train = int(len(X) * TRAIN_FRAC)
    scaler = StandardScaler().fit(X[:n_train])
    pca = PCA(n_components=3).fit(scaler.transform(X[:n_train]))
    err = recon_error(scaler, pca, X)
    thr = float(err[:n_train].mean() + 6 * err[:n_train].std())
    flag = err > thr
    alarm = pd.Series(flag).rolling(3).sum().fillna(0).values >= 3
    return err, alarm, n_train


def evaluate():
    results = []
    for test, cfg in TESTS.items():
        df = pd.read_csv(OUT / f"ims_{test}_features.csv")
        t = pd.to_datetime(df["time"])
        end = t.iloc[-1]
        for b in cfg["bearing_cols"]:
            err, alarm, n_train = run_bearing(df, b)
            held = alarm[n_train:]
            first = int(np.argmax(held)) + n_train if held.any() else None
            r = {
                "test": test, "bearing": b,
                "role": f"FAILED ({cfg['failing'][b]})" if b in cfg["failing"] else "control (no failure)",
                "snapshots": len(df), "run_hours": round((end - t.iloc[0]).total_seconds() / 3600, 1),
                "train_snapshots": n_train,
                "alarm_frac_first_half_heldout": round(float(alarm[n_train:len(df) // 2].mean()), 3),
                "alarm_frac_overall_heldout": round(float(held.mean()), 3),
                "first_alarm_idx": first,
                "lead_hours": round((end - t.iloc[first]).total_seconds() / 3600, 1) if first is not None else None,
                "lead_frac_of_run": round(1 - first / len(df), 3) if first is not None else None,
            }
            results.append(r)
            print(r, flush=True)
    out = pd.DataFrame(results)
    out.to_csv(OUT / "ims_multi_results.csv", index=False)
    (ROOT / "mlmodel" / "ims_multi_results.json").write_text(json.dumps(results, indent=2))
    print("\n", out.to_string(index=False))


if __name__ == "__main__":
    cmd = sys.argv[1]
    if cmd == "extract":
        for t in (sys.argv[2:] or TESTS):
            extract(t)
    elif cmd == "eval":
        evaluate()
