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

    # Port 465 = implicit SSL; 587 (or others) = optional STARTTLS. MailPit needs
    # neither and no login, so all of this is skipped when unset (dev default).
    use_ssl = settings.smtp_port == 465
    if use_ssl:
        server = smtplib.SMTP_SSL(settings.smtp_host, settings.smtp_port, timeout=10)
    else:
        server = smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=10)
    try:
        if not use_ssl and settings.smtp_starttls:
            server.starttls()
        if settings.smtp_user and settings.smtp_password:
            server.login(settings.smtp_user, settings.smtp_password)
        server.send_message(msg)
    finally:
        server.quit()


async def send_otp_email(to: str, code: str) -> None:
    body = (
        f"Your HireSignal verification code is: {code}\n\n"
        f"It expires in {settings.otp_ttl_seconds // 60} minutes."
    )
    await run_in_threadpool(_send, to, "Your HireSignal verification code", body)


async def send_password_reset_email(to: str, code: str) -> None:
    body = (
        f"Your HireSignal password reset code is: {code}\n\n"
        f"It expires in {settings.otp_ttl_seconds // 60} minutes.\n"
        f"If you didn't request a password reset, you can safely ignore this email."
    )
    await run_in_threadpool(_send, to, "Your HireSignal password reset code", body)
