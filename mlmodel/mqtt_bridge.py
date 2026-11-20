"""
MQTT -> LivePlant bridge.

Topic layout (default):  carbonedge/power/<machine>      e.g. carbonedge/power/MainTerminal
Payload: JSON {"kw": 12.3, "ts": 1700000000}  (ts optional: epoch seconds or ISO string; defaults to now)
         or a bare number (kW, timestamped on arrival).

Environment:
  MQTT_HOST (localhost)  MQTT_PORT (1883)  MQTT_TOPIC (carbonedge/power/#)
  MQTT_USER / MQTT_PASSWORD (optional)     MQTT_TLS=1 to enable TLS
  LIVE_TZ (UTC)  timezone used for the 15-minute bins and weekday/hour features

Security note: a default broker has no authentication. For anything beyond localhost use TLS and
credentials on the broker and set MQTT_TLS / MQTT_USER / MQTT_PASSWORD here.
"""
import json
import os
import threading
import time
from collections import deque

import paho.mqtt.client as mqtt

from live_plant import LivePlant, to_local

MAX_BACKLOG = 700


class MqttBridge:
    def __init__(self):
        self.host = os.environ.get("MQTT_HOST", "localhost")
        self.port = int(os.environ.get("MQTT_PORT", "1883"))
        self.topic = os.environ.get("MQTT_TOPIC", "carbonedge/power/#")
        self.tz = os.environ.get("LIVE_TZ", "UTC")
        self.plant = LivePlant()
        self.messages = deque(maxlen=MAX_BACKLOG)
        self.total_out = 0
        self.connected = False
        self.error = None
        self.readings = 0
        self._lock = threading.Lock()
        self._client = None

    def start(self):
        if self._client is not None:
            return
        c = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2)
        if os.environ.get("MQTT_USER"):
            c.username_pw_set(os.environ["MQTT_USER"], os.environ.get("MQTT_PASSWORD"))
        if os.environ.get("MQTT_TLS") == "1":
            c.tls_set()
        c.on_connect = self._on_connect
        c.on_disconnect = self._on_disconnect
        c.on_message = self._on_message
        self._client = c
        try:
            c.connect_async(self.host, self.port, keepalive=30)
            c.loop_start()
        except Exception as e:  # pragma: no cover
            self.error = str(e)

    def stop(self):
        if self._client is not None:
            self._client.loop_stop()
            self._client.disconnect()
            self._client = None

    # ---- callbacks (run in paho's thread) -----------------------------------------------------
    def _on_connect(self, client, userdata, flags, reason_code, properties=None):
        if getattr(reason_code, "is_failure", False):
            self.connected, self.error = False, f"connect refused: {reason_code}"
            return
        self.connected, self.error = True, None
        client.subscribe(self.topic)

    def _on_disconnect(self, client, userdata, flags, reason_code, properties=None):
        self.connected = False

    def _on_message(self, client, userdata, msg):
        try:
            machine = msg.topic.rsplit("/", 1)[-1]
            raw = msg.payload.decode("utf-8", "replace").strip()
            if raw.startswith("{"):
                d = json.loads(raw)
                kw, ts = float(d["kw"]), d.get("ts")
            else:
                kw, ts = float(raw), None
            if kw != kw or abs(kw) > 1e6:     # NaN or absurd value
                return
            t = to_local(ts if ts is not None else time.time(), self.tz)
        except Exception:
            return                              # malformed payload: ignore
        with self._lock:
            self.readings += 1
            for row in self.plant.add(machine, t, kw):
                self.messages.append(row)
                self.total_out += 1

    # ---- read side (used by the websocket) ----------------------------------------------------
    def snapshot(self):
        with self._lock:
            return list(self.messages), self.total_out

    def status(self):
        return {"connected": self.connected, "error": self.error, "readings": self.readings,
                "intervals": self.total_out, "host": self.host, "port": self.port, "topic": self.topic}


_bridge = None


def get_bridge():
    global _bridge
    if _bridge is None:
        _bridge = MqttBridge()
        _bridge.start()
    return _bridge
