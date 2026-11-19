"""
Hydraulic test rig (ZeMA / UCI #447): per-cycle features + unsupervised fault detection.

Labels (profile.txt): cooler, valve, pump leakage, accumulator, stable flag.
HEALTHY = cooler 100, valve 100, leakage 0, accumulator 130 (all components optimal).

Method (no fault labels used for training):
  - features: mean/std/min/max of every sensor per 60 s cycle
  - fit scaler+PCA on the first 60% of the healthy cycles (in recorded order)
  - threshold = 99th percentile of reconstruction error on the next 20% of healthy cycles
    (calibration); the last 20% of healthy cycles are a held-out false-alarm check
  - every non-healthy cycle is a test positive; report detection by component and severity

Usage (from CarbonEdge/):  python mlmodel/hydraulic_pipeline.py extract | eval
"""
import sys
import json
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.metrics import roc_auc_score
from sklearn.preprocessing import StandardScaler
from sklearn.decomposition import PCA

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "hydraulic" / "raw"
OUT = ROOT / "data" / "processed"
SENSORS = ["PS1", "PS2", "PS3", "PS4", "PS5", "PS6", "EPS1", "FS1", "FS2",
           "TS1", "TS2", "TS3", "TS4", "VS1", "CE", "CP", "SE"]
COMPONENTS = ["cooler", "valve", "pump_leak", "accumulator"]
HEALTHY_VALUES = dict(cooler=100, valve=100, pump_leak=0, accumulator=130)
Q = 99.0
N_COMP = 5


def extract():
    OUT.mkdir(parents=True, exist_ok=True)
    cols = {}
    for s in SENSORS:
        a = pd.read_csv(RAW / f"{s}.txt", sep="\t", header=None).values
        cols[f"{s}_mean"] = a.mean(1)
        cols[f"{s}_std"] = a.std(1)
        cols[f"{s}_min"] = a.min(1)
        cols[f"{s}_max"] = a.max(1)
        print("done", s, a.shape, flush=True)
    feats = pd.DataFrame(cols)
    prof = pd.read_csv(RAW / "profile.txt", sep="\t", header=None,
                       names=COMPONENTS + ["stable"])
    pd.concat([prof, feats], axis=1).to_csv(OUT / "hydraulic_features.csv", index=False)
    print("saved", len(feats), "cycles")


def load():
    df = pd.read_csv(OUT / "hydraulic_features.csv")
    healthy = np.ones(len(df), bool)
    for c, v in HEALTHY_VALUES.items():
        healthy &= df[c].values == v
    return df, healthy


def evaluate():
    """DO NOT USE AS A RESULT. Kept only to show why the unsupervised framing fails here:
    just 21 of 2,205 cycles are fully healthy (12 fit / 4 calibration / 5 held-out), far too few
    for a threshold or a false-alarm rate to mean anything. Use `diagnose` instead."""
    print("WARNING: only ~21 healthy cycles exist; the numbers below are NOT a valid result.")
    df, healthy = load()
    X = df.drop(columns=COMPONENTS + ["stable"]).values
    hidx = np.where(healthy)[0]
    print(f"cycles={len(df)}  healthy={len(hidx)}  non-healthy={len(df) - len(hidx)}")
    n = len(hidx)
    fit_i, cal_i, hold_i = hidx[:int(n * .6)], hidx[int(n * .6):int(n * .8)], hidx[int(n * .8):]
    scaler = StandardScaler().fit(X[fit_i])
    pca = PCA(n_components=N_COMP).fit(scaler.transform(X[fit_i]))

    def err(ix):
        Z = scaler.transform(X[ix])
        return np.mean((Z - pca.inverse_transform(pca.transform(Z))) ** 2, axis=1)

    e_all = err(np.arange(len(df)))
    thr = float(np.percentile(e_all[cal_i], Q))
    flag = e_all > thr

    res = {"cycles": len(df), "healthy": int(n), "fit": len(fit_i), "cal": len(cal_i),
           "heldout_healthy": len(hold_i), "threshold": thr,
           "false_alarm_heldout_healthy": float(flag[hold_i].mean())}
    bad = ~healthy
    res["auroc_healthy_vs_faulty"] = float(roc_auc_score(bad[np.r_[hold_i, np.where(bad)[0]]],
                                                       e_all[np.r_[hold_i, np.where(bad)[0]]]))
    res["detect_rate_all_faulty"] = float(flag[bad].mean())

    print(f"\nthreshold={thr:.3f} (p{Q} of calibration)")
    print(f"false alarms on held-out healthy cycles: {flag[hold_i].mean():.1%} of {len(hold_i)}")
    print(f"AUROC healthy-vs-faulty: {res['auroc_healthy_vs_faulty']:.3f}")
    print(f"detection rate over ALL faulty cycles: {flag[bad].mean():.1%} of {bad.sum()}")

    # by component and severity: cycles where that component is at the level (others anything),
    # and "isolated" = every other component optimal
    res["by_component"] = {}
    print("\ncomponent  level -> n | flagged(any others) | n_isolated | flagged(isolated)")
    for c in COMPONENTS:
        res["by_component"][c] = {}
        others = [o for o in COMPONENTS if o != c]
        others_ok = np.ones(len(df), bool)
        for o in others:
            others_ok &= df[o].values == HEALTHY_VALUES[o]
        for lvl in sorted(df[c].unique()):
            m = df[c].values == lvl
            iso = m & others_ok
            r = dict(n=int(m.sum()), flagged=float(flag[m].mean()),
                     n_isolated=int(iso.sum()),
                     flagged_isolated=float(flag[iso].mean()) if iso.sum() else None)
            res["by_component"][c][str(lvl)] = r
            tag = "(healthy level)" if lvl == HEALTHY_VALUES[c] else ""
            iso_s = f"{r['flagged_isolated']:.0%}" if r["flagged_isolated"] is not None else "n/a"
            print(f"{c:12} {lvl:>4} -> {r['n']:4d} | {r['flagged']:5.0%} | {r['n_isolated']:4d} | {iso_s:>5} {tag}")


def diagnose():
    """Supervised fault DIAGNOSIS with leakage-safe grouped cross-validation.

    The dataset has only 21 fully healthy cycles, so an unsupervised healthy-baseline
    detector cannot be evaluated reliably (see `eval`). Instead: which component is degraded?
    Neighbouring cycles share identical conditions (near-duplicates), so we never split a
    group across train/test:
      - by_run:   groups = contiguous runs of identical conditions
      - by_combo: groups = whole fault combinations (tests UNSEEN fault combinations)
    """
    from sklearn.ensemble import RandomForestClassifier
    from sklearn.model_selection import GroupKFold
    from sklearn.metrics import accuracy_score, balanced_accuracy_score
    df, _ = load()
    X = df.drop(columns=COMPONENTS + ["stable"]).values
    key = df[COMPONENTS].astype(str).agg("-".join, axis=1)
    groups = {"by_run": (key != key.shift()).cumsum().values,
              "by_combo": key.astype("category").cat.codes.values}
    out = {}
    oof = pd.DataFrame({"cycle": np.arange(len(df))})
    print(f"{'component':12} {'split':9} {'majority':>9} {'accuracy':>9} {'balanced':>9}")
    for c in COMPONENTS:
        y = df[c].values
        maj = float(pd.Series(y).value_counts(normalize=True).iloc[0])
        for gname, g in groups.items():
            pred = np.empty_like(y)
            for tr, te in GroupKFold(n_splits=5).split(X, y, g):
                clf = RandomForestClassifier(n_estimators=200, random_state=0, n_jobs=-1)
                clf.fit(X[tr], y[tr])
                pred[te] = clf.predict(X[te])
            acc, bal = accuracy_score(y, pred), balanced_accuracy_score(y, pred)
            if gname == "by_run":
                oof[f"true_{c}"] = y
                oof[f"pred_{c}"] = pred
            out[f"{c}/{gname}"] = dict(majority=maj, accuracy=float(acc), balanced_accuracy=float(bal))
            print(f"{c:12} {gname:9} {maj:9.1%} {acc:9.1%} {bal:9.1%}")
    for col in ["PS1_mean", "TS1_mean", "EPS1_mean", "CE_mean"]:
        oof[col] = df[col].values
    oof.to_csv(OUT / "hydraulic_predictions.csv", index=False)
    p = Path(__file__).resolve().parent / "hydraulic_diagnosis.json"
    p.write_text(json.dumps(out, indent=2))


if __name__ == "__main__":
    {"extract": extract, "eval": evaluate, "diagnose": diagnose}[sys.argv[1]]()
