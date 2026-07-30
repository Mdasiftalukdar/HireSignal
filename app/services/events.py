"""Kafka producer for the analysis pipeline (Phase 9).

The API publishes an analysis job to a topic; a separate consumer service does the work.
Started/stopped via the FastAPI lifespan. Connecting is retried because Kafka may still be
booting when the API starts.
"""

import asyncio
import json
import logging

from aiokafka import AIOKafkaProducer
from aiokafka.errors import KafkaConnectionError

from app.core.config import settings

logger = logging.getLogger("hiresignal.events")

_producer: AIOKafkaProducer | None = None


async def start_producer() -> None:
    global _producer
    producer = AIOKafkaProducer(bootstrap_servers=settings.kafka_bootstrap_servers)
    for attempt in range(20):
        try:
            await producer.start()
            _producer = producer
            logger.info("Kafka producer connected")
            return
        except KafkaConnectionError:
            logger.info("waiting for Kafka (producer attempt %d)...", attempt + 1)
            await asyncio.sleep(2)
    logger.warning("Kafka producer could not connect; /analyze will be unavailable")


async def stop_producer() -> None:
    global _producer
    if _producer is not None:
        await _producer.stop()
        _producer = None


async def publish_analysis(analysis_id: int) -> None:
    if _producer is None:
        raise RuntimeError("Kafka producer is not available")
    # Key by analysis_id so a given job always maps to the same partition (ordering).
    await _producer.send_and_wait(
        settings.kafka_topic_analysis,
        key=str(analysis_id).encode(),
        value=json.dumps({"analysis_id": analysis_id}).encode(),
    )
