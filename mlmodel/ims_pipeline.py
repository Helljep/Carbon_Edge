"""
CarbonEdge - real-data pipeline on the NASA IMS bearing run-to-failure dataset.

Steps:
  1. extract : read raw vibration snapshots from IMS.zip -> one feature row per snapshot
  2. train   : fit an anomaly model on the early (healthy) period ONLY
  3. eval    : score the whole run, report detection lead time and false alarms

Usage (from CarbonEdge/):
  python mlmodel/ims_pipeline.py extract
  python mlmodel/ims_pipeline.py train
  python mlmodel/ims_pipeline.py eval

Test set used: "2nd_test" (bearing 1 outer-race failure at the end of the run).
Time-based split: first 25% of snapshots = healthy training, never random.
"""
import io
import sys
import json
import zipfile
import re
from pathlib import Path

import numpy as np
import pandas as pd
import joblib
from scipy import stats
from sklearn.preprocessing import StandardScaler
from sklearn.decomposition import PCA

ROOT = Path(__file__).resolve().parent.parent
ZIP_PATH = ROOT / "data" / "ims" / "IMS.zip"
OUT_DIR = ROOT / "data" / "processed"
MODEL_DIR = Path(__file__).resolve().parent / "ims_model"
FEATURES_CSV = OUT_DIR / "ims_features.csv"

FS = 20480            # sampling rate (Hz) from the IMS readme
TRAIN_FRAC = 0.25     # first 25% of the run = healthy
FAIL_BEARING = 0      # 2nd_test: bearing 1 (column 0) failed


def band_energy(x, lo, hi):
    spec = np.abs(np.fft.rfft(x)) ** 2
    freqs = np.fft.rfftfreq(len(x), 1 / FS)
    return float(spec[(freqs >= lo) & (freqs < hi)].sum())


def features(sig):
    rms = float(np.sqrt(np.mean(sig ** 2)))
    peak = float(np.max(np.abs(sig)))
    return {
        "rms": rms,
        "peak": peak,
        "kurtosis": float(stats.kurtosis(sig)),
        "skew": float(stats.skew(sig)),
        "crest": peak / rms if rms else 0.0,
        "band_0_2k": band_energy(sig, 0, 2000),
        "band_2k_5k": band_energy(sig, 2000, 5000),
        "band_5k_10k": band_energy(sig, 5000, 10000),
    }


def extract():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    folder = ROOT / "data" / "ims" / "2nd_test" / "2nd_test"
    snaps = sorted(p for p in folder.iterdir() if p.is_file())
    print("snapshots:", len(snaps))
    rows = []
    for i, p in enumerate(snaps):
        arr = np.loadtxt(p, delimiter="	")
        f = features(arr[:, FAIL_BEARING])
        f["t"] = i
        f["file"] = p.name
        rows.append(f)
    pd.DataFrame(rows).to_csv(FEATURES_CSV, index=False)
    print("saved", FEATURES_CSV)


FEATURE_COLS = ["rms", "peak", "kurtosis", "skew", "crest",
                "band_0_2k", "band_2k_5k", "band_5k_10k"]


def prep(df):
    X = df[FEATURE_COLS].copy()
    for c in ["band_0_2k", "band_2k_5k", "band_5k_10k"]:
        X[c] = np.log1p(X[c])
    return X.values


def train():
    df = pd.read_csv(FEATURES_CSV)
    n_train = int(len(df) * TRAIN_FRAC)
    X = prep(df.iloc[:n_train])
    scaler = StandardScaler().fit(X)
    pca = PCA(n_components=3).fit(scaler.transform(X))
    err = recon_error(scaler, pca, X)
    threshold = float(np.mean(err) + 6 * np.std(err))
    MODEL_DIR.mkdir(exist_ok=True)
    joblib.dump({"scaler": scaler, "pca": pca}, MODEL_DIR / "model.joblib")
    (MODEL_DIR / "meta.json").write_text(json.dumps(
        {"threshold": threshold, "train_snapshots": n_train, "features": FEATURE_COLS}, indent=2))
    print(f"trained on {n_train} healthy snapshots, threshold={threshold:.3f}")


def recon_error(scaler, pca, X):
    Z = scaler.transform(X)
    R = pca.inverse_transform(pca.transform(Z))
    return np.mean((Z - R) ** 2, axis=1)


def evaluate():
    df = pd.read_csv(FEATURES_CSV)
    m = joblib.load(MODEL_DIR / "model.joblib")
    meta = json.loads((MODEL_DIR / "meta.json").read_text())
    err = recon_error(m["scaler"], m["pca"], prep(df))
    thr = meta["threshold"]
    flag = err > thr
    # require 3 consecutive flags to alarm (cuts one-off noise)
    alarm = pd.Series(flag).rolling(3).sum().fillna(0).values >= 3
    n_train = meta["train_snapshots"]
    held_end = int(len(df) * 0.5)  # RMS is flat through here; before visible drift
    held_healthy = alarm[n_train:held_end]
    first = int(np.argmax(alarm[n_train:])) + n_train if alarm[n_train:].any() else None
    total_h = (len(df) - 1) * 10 / 60  # snapshots are 10 min apart
    print(f"snapshots={len(df)}  run length ~{total_h:.0f} h")
    print(f"held-out healthy snapshots {n_train}-{held_end}: {int(held_healthy.sum())} alarms of {len(held_healthy)} ({held_healthy.mean():.1%} false alarm rate)")
    if first is None:
        print("no alarm raised before failure")
    else:
        lead = (len(df) - 1 - first) * 10 / 60
        print(f"first sustained alarm at snapshot {first}: ~{lead:.0f} h before end of run")
    df["error"] = err
    df["alarm"] = alarm
    df.to_csv(OUT_DIR / "ims_scored.csv", index=False)


if __name__ == "__main__":
    {"extract": extract, "train": train, "eval": evaluate}[sys.argv[1]]()
