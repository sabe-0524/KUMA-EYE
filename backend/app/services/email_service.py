"""
Bear Detection System - SMTP Email Service
"""
import smtplib
import ssl
from email.message import EmailMessage

from app.core.config import settings


class SMTPEmailService:
    """SMTP経由でメールを送信するサービス"""

    def send_email(self, to_email: str, subject: str, body: str) -> None:
        if not settings.SMTP_HOST:
            raise RuntimeError("SMTP_HOST is not configured")
        if not settings.SMTP_FROM:
            raise RuntimeError("SMTP_FROM is not configured")

        message = EmailMessage()
        message["From"] = settings.SMTP_FROM
        message["To"] = to_email
        message["Subject"] = subject
        message.set_content(body)

        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=15) as smtp:
            if settings.SMTP_USE_TLS:
                context = ssl.create_default_context()
                smtp.starttls(context=context)

            if settings.SMTP_USERNAME and settings.SMTP_PASSWORD:
                smtp.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)

            smtp.send_message(message)


_email_service: SMTPEmailService | None = None


def get_email_service() -> SMTPEmailService:
    global _email_service
    if _email_service is None:
        _email_service = SMTPEmailService()
    return _email_service
