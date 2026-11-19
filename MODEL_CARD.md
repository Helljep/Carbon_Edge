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

## Limitations
- **Single bearing, single run.** No evidence yet of generalization to other bearings, machines or plants.
- **No labelled fault onset.** Lead time is measured against end of run, not a ground-truth onset.
- **Threshold choice** (6σ, 3-in-a-row) was set once, on training data. Sensitivity to these settings has not been studied.
- **Replay, not live.** The dashboard replays recorded data; no live sensor integration.
- **Lab data.** A test rig with a fixed load and speed. Real plants have varying load, noise and maintenance events.

## Intended use
Demonstration and research on early fault detection. Not for safety-critical decisions.

## Next steps
Repeat on IMS `1st_test` and `3rd_test`; study threshold sensitivity; add other machine types; validate on real plant data.
