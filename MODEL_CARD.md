# Model Card: Bearing Anomaly Detector

## Purpose
Flag a degrading rotating-machine bearing early from vibration data, before it fails. Decision support only, not a safety system.

## Data
- **Source:** NASA IMS bearing dataset, `2nd_test` (University of Cincinnati, Center for Intelligent Maintenance Systems; hosted on the NASA Prognostics Data Repository).
- **Content:** 984 snapshots, 10 minutes apart, about 164 hours, 12 to 19 February 2004. Sampled at 20,480 Hz. Run to failure of bearing 1 (outer race).
- **Used:** channel 0 (bearing 1) only.

## Features (per snapshot)
RMS, peak, kurtosis, skewness, crest factor, and spectral energy in 0–2 kHz, 2–5 kHz and 5–10 kHz (log-scaled).

## Model
- Standardize features, then PCA with 3 components, fit on healthy data only.
- Anomaly score = mean squared reconstruction error.
- Threshold = mean + 6 × std of the training score (1.85).
- Alarm = 3 consecutive snapshots above threshold.
- Trained locally on a laptop CPU in seconds (scikit-learn).

## Evaluation
- **Split:** time-based. Train on snapshots 0–245 (first 25%); the rest is held out.
- **False alarms:** 0 of 246 held-out healthy snapshots (246–492, before visible drift).
- **Detection:** first sustained alarm at snapshot 539, about 74 hours before the end of the run.
- **After onset:** 95.7% of snapshots 539–700 flagged, 100% from 700 onward.

## Multi-test evaluation (`mlmodel/ims_multi_eval.py`)
Same method, one independent model per bearing, all 3 IMS tests (12 bearing runs; results in `mlmodel/ims_multi_results.json`).

| Test | Bearing | Documented outcome | Result |
|---|---|---|---|
| 1st | b3 | inner race failure | detected, ~253 h before end |
| 1st | b4 | roller element failure | detected, ~120 h before end |
| 2nd | b1 | outer race failure | detected, ~74 h before end |
| 3rd | b3 | outer race failure | **missed** (score rose ~9x, stayed under threshold) |

- 3 of 4 failures detected; 1 missed.
- Held-out first-half alarm rate at most 0.4% across all 12 runs.
- 8 control bearings (no reported failure): 3 stayed quiet, 5 raised sustained alarms later in the run. Unlabelled, so these may be genuine wear, cross-talk through the shared shaft, or false alarms; the model cannot tell them apart.
- The 3rd test archive holds 6,324 files; only the 4,448 documented in the NASA readme were used.

## Threshold sensitivity (`mlmodel/ims_threshold_study.py`)
- Grid: k in {2,3,4,5,6,8,10} sigma x m in {1,3,5} consecutive flags (results: `mlmodel/ims_threshold_study.json`).
- Lower thresholds catch all 4 failures (e.g. k=4, m=3: 4/4 detected, 0.17% first-half false alarms) but the missed 3rd-test bearing then gets only ~9 h warning; k=3 gives ~181 h with 0.66% overall alarms.
- Leave-one-test-out (setting chosen on two tests, scored on the third): 3 of 4 failures detected, same as the fixed default. One chosen setting gave 2.9% false alarms on its held-out test; another missed the 3rd-test failure.
- Takeaway: the setting does not transfer across tests. Per-machine calibration is required. The "best" row of the full grid is optimistic because it was seen in full; the leave-one-test-out numbers are the honest estimate.

## Per-machine calibration (`mlmodel/ims_calibration_study.py`)
- Method: baseline = first 15/25/40% of a bearing's run; first 60% of it fits scaler+PCA, last 40% calibrates. Threshold = percentile (99 / 99.9 / 100) of calibration errors x margin (1.0 / 1.5 / 2.0), 3 in a row. No failure labels used. Results: `mlmodel/ims_calibration_study.json`.
- Leave-one-test-out (rule fixed in advance: healthy-region false alarms <= 0.5%, then most detections, ties -> larger margin): **3 of 4** failures detected; 0% healthy-region false alarms in all three folds (earlier method: 2.9% in one fold).
- The 3rd-test failure is still missed under this rule. Settings catching all 4 exist (e.g. 25% baseline, p99, 1.5x: median warning ~144 h, max 0.9% healthy-region false alarms) but were found after seeing all results, so they are not validated.
- Takeaway: calibration makes false alarms more predictable across machines; it does not by itself make the subtle failure detectable. Only 4 failed bearings, so single-detection differences are not meaningful.

## Other machines (summary; details in README)
- **Hydraulic rig (ZeMA, UCI #447):** only 21 of 2,205 cycles are fully healthy, so no unsupervised baseline is evaluated. Random-forest diagnosis with grouped CV (by run / by unseen fault combination): cooler 97.8% / 95.5%, pump leakage 99.1% / 99.1%, accumulator 78.9% / 75.7%, valve 66.6% / 64.3% (weak). Majority baselines 33.6%, 55.4%, 36.6%, 51.0%.
- **Steel plant energy (UCI #851):** calendar-only expected-usage model, held-out Oct-Dec MAE 11.1 vs 28.3 kWh naive. CO2 is derived from kWh. No waste labels, so flags ("unexpectedly high", 2.8% of intervals) are not validated detections.
- **Electronics plant (HIPE, real smart meters, 3 months):** median weekday/weekend profile (Oct-Nov), threshold from early Dec, tested on Dec 10-31: MAE 3.35 kW vs 6.13 kW naive mean, but a "same time last week" rule is better (2.79 kW). Base load is about 45% of energy; the 10 sub-metered machines are only 4.1% of plant energy. No fault or waste labels, so flags are not validated.

## Limitations
- **One lab rig family.** Same bearing model, speed and load in all three tests. No evidence yet for other machines or plants.
- **A missed failure** (3rd test, bearing 3) at the fixed threshold.
- **No labelled fault onset.** Lead time is measured against end of run, not a ground-truth onset.
- **Threshold choice** (6σ, 3-in-a-row) is a trade-off that does not transfer between tests (see above).
- **Replay, not live.** The dashboard replays recorded data; no live sensor integration.
- **Lab data.** A test rig with a fixed load and speed. Real plants have varying load, noise and maintenance events.

## Intended use
Demonstration and research on early fault detection. Not for safety-critical decisions.

## Next steps
Validate a calibrated setting on new, unseen machines; add other machine types; validate on real plant data.
