"""
Live plant-energy engine: turns a stream of power readings (e.g. from MQTT) into the same 15-minute
messages the dashboard already understands (type "hipe").

Baseline = mean of the same 15-minute slot in the previous 1-2 weeks (the winner of the HIPE baseline
comparison). A live plant has no history at first, so the engine reports split="learning" and never
flags until it has enough data of its own:
  - base load and alert threshold need ~3.5 days of finished intervals
  - an expected value for an interval needs that same slot one week earlier

Readings: machine name + timestamp + kW. The plant main meter is named MAIN_NAME ("MainTerminal").
"""
from collections import deque

import numpy as np
import pandas as pd

MAIN_NAME = "MainTerminal"
INTERVAL_H = 0.25
WEEK = pd.Timedelta(days=7)
KEEP = pd.Timedelta(days=21)
MIN_BINS = 336            # 3.5 days of 15-min intervals before base load / threshold are trusted
IDLE_METERED_KW = 0.5
TCO2_PER_KWH = 0.0004


def to_local(ts, tz="UTC"):
    """Epoch seconds / ISO string / datetime -> naive local Timestamp in `tz`."""
    if isinstance(ts, (int, float, np.integer, np.floating)):
        t = pd.Timestamp(float(ts), unit="s", tz="UTC")
    else:
        t = pd.Timestamp(ts)
        t = t.tz_localize("UTC") if t.tzinfo is None else t
    return t.tz_convert(tz).tz_localize(None)


class LivePlant:
    def __init__(self, main_name=MAIN_NAME):
        self.main_name = main_name
        self.cur_bin = None
        self.cur = {}                 # machine -> [sum, count] in the current bin
        self.main_hist = {}           # finished bin -> main kW
        self.resid = deque(maxlen=2016)
        self.index = 0
        self.cum_kwh = self.cum_base = self.cum_idle = 0.0

    # ---- ingest -------------------------------------------------------------------------------
    def add(self, machine, ts, kw):
        """Add one reading. Returns a list with a finished-interval message when an interval closes."""
        b = pd.Timestamp(ts).floor("15min")
        out = []
        if self.cur_bin is None:
            self.cur_bin = b
        if b > self.cur_bin:
            msg = self._finalize()
            if msg:
                out.append(msg)
            self.cur_bin, self.cur = b, {}
        elif b < self.cur_bin:
            return out                # late reading for a finished interval: ignored
        s = self.cur.setdefault(machine, [0.0, 0])
        s[0] += float(kw)
        s[1] += 1
        return out

    # ---- helpers ------------------------------------------------------------------------------
    def _expected(self, t):
        vals = [self.main_hist[t - k * WEEK] for k in (1, 2) if (t - k * WEEK) in self.main_hist]
        return float(np.mean(vals)) if vals else None

    def _prune(self, t):
        for k in [k for k in self.main_hist if k < t - KEEP]:
            del self.main_hist[k]

    def _finalize(self):
        t = self.cur_bin
        means = {m: v[0] / v[1] for m, v in self.cur.items() if v[1]}
        main = means.pop(self.main_name, None)
        if main is None:
            return None               # no plant-meter reading in this interval
        main = max(main, 0.0)
        exp = self._expected(t)
        self.main_hist[t] = main
        self._prune(t)
        if exp is not None:
            self.resid.append(main - exp)

        enough = len(self.main_hist) >= MIN_BINS and len(self.resid) >= MIN_BINS
        base = float(np.percentile(list(self.main_hist.values()), 10)) if len(self.main_hist) >= MIN_BINS else None
        thr = max(float(np.percentile(list(self.resid), 95)), 1.0) if len(self.resid) >= MIN_BINS else None
        learning = not (enough and exp is not None and base is not None and thr is not None)

        metered = float(sum(max(v, 0.0) for v in means.values()))
        kwh = main * INTERVAL_H
        self.cum_kwh += kwh
        idle = metered < IDLE_METERED_KW
        if idle:
            self.cum_idle += kwh
        base_v = base if base is not None else main
        self.cum_base += min(main, base_v) * INTERVAL_H
        row = {
            "type": "hipe", "index": self.index, "total": self.index + 1,
            "time": t.strftime("%Y-%m-%d %H:%M"), "weekday": t.strftime("%a"),
            "split": "learning" if learning else "live",
            "main_kw": round(main, 2), "metered_kw": round(metered, 2),
            "unmetered_kw": round(max(0.0, main - metered), 2),
            "expected_kw": round(exp if exp is not None else main, 2),
            "base_kw": round(base_v, 2),
            "threshold_kw": round(thr if thr is not None else 1.0, 2),
            "high": bool((not learning) and main > exp + thr),
            "idle": bool(idle),
            "machines": {m: round(max(v, 0.0), 2) for m, v in means.items()},
            "cum_kwh": round(self.cum_kwh, 1), "cum_base_kwh": round(self.cum_base, 1),
            "cum_idle_kwh": round(self.cum_idle, 1), "cum_tco2": round(self.cum_kwh * TCO2_PER_KWH, 3),
        }
        self.index += 1
        return row
