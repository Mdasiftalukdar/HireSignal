"""Object storage via the S3 API - MinIO locally, AWS S3 in production.

The *same* boto3 client works for both: MinIO is S3-compatible, so only the endpoint URL
and credentials differ (that's the whole point of coding against the S3 API). boto3 calls
are synchronous, so endpoints invoke these via `run_in_threadpool`.
"""

import time

import boto3
from botocore.client import Config

from app.core.config import settings

_client = None
_bucket_ready = False


def _s3():
    global _client
    if _client is None:
        _client = boto3.client(
            "s3",
            endpoint_url=settings.s3_endpoint_url or None,  # None -> real AWS
            aws_access_key_id=settings.aws_access_key_id,
            aws_secret_access_key=settings.aws_secret_access_key,
            region_name=settings.aws_region,
            config=Config(signature_version="s3v4"),
        )
    return _client


def ensure_bucket() -> None:
    """Create the bucket if missing. Retries because MinIO may still be booting."""
    global _bucket_ready
    if _bucket_ready:
        return
    last_err: Exception | None = None
    for _ in range(15):
        try:
            names = [b["Name"] for b in _s3().list_buckets().get("Buckets", [])]
            if settings.s3_bucket not in names:
                _s3().create_bucket(Bucket=settings.s3_bucket)
            _bucket_ready = True
            return
        except Exception as exc:  # storage not reachable yet
            last_err = exc
            time.sleep(1)
    raise RuntimeError(f"Object storage not reachable: {last_err}")


def upload_bytes(
    key: str, data: bytes, content_type: str = "application/octet-stream"
) -> str:
    ensure_bucket()
    _s3().put_object(
        Bucket=settings.s3_bucket, Key=key, Body=data, ContentType=content_type
    )
    return key
