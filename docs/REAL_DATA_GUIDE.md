# Getting real data into CarbonEdge

Public datasets can only take this project so far. The most valuable thing you can add is data from a
machine or meter you can physically check. This guide is practical and deliberately conservative.

## Safety and permission first
- Never open a live mains panel yourself. Use a **non-invasive current clamp (CT)** or a **certified energy
  meter installed by a qualified electrician**. If a plant is involved, get written permission from the owner.
- Do not publish another organisation's data without their consent. Anonymise machine and site names.

## What to record
| Goal | Sensor | Rate | Minimum |
|---|---|---|---|
| Plant / building energy baseline and base load | Clamp-on CT meter or smart meter (kW) | 1 reading per minute is plenty | **4 weeks** (2 weeks of history + test) |
| Per-machine energy | One meter per machine or circuit | 1 per minute | 4 weeks |
| Rotating-machine health (pump, motor, fan) | Vibration sensor (accelerometer, e.g. ADXL345 / MPU6050 on a microcontroller) | 1 kHz+ in short bursts (for example 2 s every 10 min) | Until a fault or a planned maintenance event |

Write down **events**: maintenance, breakdowns, shutdowns, holidays, production changes. Without labels the
system can only report baselines, not detection accuracy. A simple dated list is enough.

## Cheap starting hardware (examples, verify specs and safety certification yourself)
- Energy: a single-phase meter module with a CT clamp (for example the PZEM-004T family) or a commercial smart
  plug with energy monitoring for a small appliance, read by an ESP32.
- Vibration: an accelerometer bolted to the bearing housing, read by an ESP32 or Raspberry Pi.

## Getting it into CarbonEdge
1. **Offline evaluation (start here).** Export a CSV with a timestamp column and a power column (kW):
   ```
   python mlmodel/evaluate_csv.py my_meter.csv --time-col timestamp --main-col power_kw --tz Asia/Kolkata
   ```
   It compares four baselines with chronological splits and reports the error, the base-load share and
   the share of intervals flagged. It refuses data shorter than 28 days.
2. **Live via MQTT.** Publish readings to `carbonedge/power/<machine>` with JSON `{"kw": 3.2, "ts": 1700000000}`
   (the plant meter must be named `MainTerminal`; other names are sub-meters). Run the backend and start the
   frontend with `VITE_PLANT_SOURCE=live`. The engine shows "learning" until it has about 3.5 days of its own
   data and a reading from one week earlier; it never flags before that.
3. For production use a real broker (Mosquitto/EMQX) with TLS and credentials. The bundled test broker
   (`mlmodel/mqtt_dev_broker.py`) is anonymous and bound to localhost only.

## What this will and will not tell you
- It will tell you how predictable your plant's energy is, how big the base load is, and what fraction of use
  the sub-meters explain.
- It will **not** prove fault detection or savings. For that you need labelled events and a before/after
  comparison over a longer period.
- Vibration data from your own machine needs the bearing pipeline (`mlmodel/ims_pipeline.py`) pointed at your
  files; that adapter is not written yet.
