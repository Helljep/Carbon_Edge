"""
Demo publisher: replays the recorded HIPE 15-minute data (data/processed/hipe_15min.csv) to an MQTT
broker as if the meters were live, one reading per machine per interval, with the original timestamps.
This tests the connector end to end; it is NOT live data.

  python mlmodel/mqtt_publish_demo.py --start 2017-10-01 --days 18 --delay 0.01
"""
import argparse
import json
import time
from pathlib import Path

import pandas as pd
import paho.mqtt.client as mqtt

CSV = Path(__file__).resolve().parent.parent / "data" / "processed" / "hipe_15min.csv"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--host", default="localhost")
    ap.add_argument("--port", type=int, default=1883)
    ap.add_argument("--prefix", default="carbonedge/power")
    ap.add_argument("--start", default="2017-10-01")
    ap.add_argument("--days", type=int, default=18)
    ap.add_argument("--delay", type=float, default=0.01, help="seconds between intervals")
    a = ap.parse_args()

    df = pd.read_csv(CSV, parse_dates=["time"]).set_index("time")
    start = pd.Timestamp(a.start)
    df = df[(df.index >= start) & (df.index < start + pd.Timedelta(days=a.days))]
    c = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2)
    c.connect(a.host, a.port)
    c.loop_start()
    n = 0
    for t, row in df.iterrows():
        # the file holds local Europe/Berlin wall time; send it as UTC-labelled so bins match the file
        ts = t.tz_localize("UTC").isoformat()
        for machine, kw in row.items():
            c.publish(f"{a.prefix}/{machine}", json.dumps({"kw": float(kw), "ts": ts}), qos=0)
            n += 1
        time.sleep(a.delay)
    time.sleep(1)
    c.loop_stop()
    c.disconnect()
    print(f"published {n} readings for {len(df)} intervals")


if __name__ == "__main__":
    main()
