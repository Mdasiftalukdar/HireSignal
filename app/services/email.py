"""Send transactional email over SMTP (MailPit locally; a real provider in production).

`smtplib` is blocking, so we send from a threadpool to keep the event loop free.
"""

import smtplib
from email.message import EmailMessage

from fastapi.concurrency import run_in_threadpool

from app.core.config import settings


def _send(to: str, subject: str, body: str) -> None:
    msg = EmailMessage()
    msg["From"] = settings.smtp_from
    msg["To"] = to
    msg["Subject"] = subject
    msg.set_content(body)
    with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=10) as server:
        server.send_message(msg)


async def send_otp_email(to: str, code: str) -> None:
    body = (
        f"Your HireSignal verification code is: {code}\n\n"
        f"It expires in {settings.otp_ttl_seconds // 60} minutes."
    )
    await run_in_threadpool(_send, to, "Your HireSignal verification code", body)
