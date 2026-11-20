"""
Local MQTT test broker (pure Python, amqtt). Listens on 127.0.0.1:1883 only, no authentication:
for development and the demo publisher, NOT for a real plant. For production use Mosquitto/EMQX
with TLS and credentials.

  python mlmodel/mqtt_dev_broker.py
"""
import asyncio
import logging

from amqtt.broker import Broker

CONFIG = {
    "listeners": {"default": {"type": "tcp", "bind": "127.0.0.1:1883"}},
    "sys_interval": 0,
    "auth": {"allow-anonymous": True, "plugins": ["auth_anonymous"]},
    "topic-check": {"enabled": False},
}


async def main():
    logging.basicConfig(level=logging.WARNING)
    broker = Broker(CONFIG)
    await broker.start()
    print("dev broker on 127.0.0.1:1883 (Ctrl+C to stop)", flush=True)
    try:
        while True:
            await asyncio.sleep(3600)
    finally:
        await broker.shutdown()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        pass
