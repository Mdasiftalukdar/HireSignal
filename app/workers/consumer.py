"""Kafka consumer service (Phase 9).

Runs as its own container (`python -m app.workers.consumer`). It reads analysis jobs from
the topic and runs the same `process_analysis` pipeline the BackgroundTask used to run - but
now durably (a job survives an API restart) and independently scalable (add more consumer
replicas in the same group to process partitions in parallel).
"""

import asyncio
import json
import logging

from aiokafka import AIOKafkaConsumer
from aiokafka.errors import KafkaConnectionError

from app.core.config import settings
from app.services.analysis import process_analysis

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("hiresignal.consumer")


async def main() -> None:
    consumer = AIOKafkaConsumer(
        settings.kafka_topic_analysis,
        bootstrap_servers=settings.kafka_bootstrap_servers,
        group_id=settings.kafka_consumer_group,
        auto_offset_reset="earliest",
        enable_auto_commit=True,
    )

    for attempt in range(30):
        try:
            await consumer.start()
            break
        except KafkaConnectionError:
            log.info("waiting for Kafka (attempt %d)...", attempt + 1)
            await asyncio.sleep(2)
    else:
        log.error("could not connect to Kafka; exiting")
        return

    log.info("consumer listening on topic '%s'", settings.kafka_topic_analysis)
    try:
        async for msg in consumer:
            try:
                analysis_id = json.loads(msg.value)["analysis_id"]
                log.info(
                    "processing analysis %s (partition %s, offset %s)",
                    analysis_id, msg.partition, msg.offset,
                )
                await process_analysis(analysis_id)
                log.info("completed analysis %s", analysis_id)
            except Exception:  # noqa: BLE001 - keep consuming despite a bad message
                log.exception("failed to process message")
    finally:
        await consumer.stop()


if __name__ == "__main__":
    asyncio.run(main())
