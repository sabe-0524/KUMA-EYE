"""
Email Service (SMTP)
"""
import smtplib
import ssl
from email.message import EmailMessage
from typing import Optional

from app.core.config import settings


class EmailService:
    def __init__(self):
        self.host = settings.SMTP_HOST
        self.port = settings.SMTP_PORT
        self.username = settings.SMTP_USERNAME
        self.password = settings.SMTP_PASSWORD
        self.from_address = settings.SMTP_FROM
        self.use_tls = settings.SMTP_USE_TLS

    def send_email(self, to_address: str, subject: str, body: str) -> None:
        if not self.host or not self.from_address:
            raise RuntimeError("SMTP settings are not configured")

        message = EmailMessage()
        message["From"] = self.from_address
        message["To"] = to_address
        message["Subject"] = subject
        message.set_content(body)

        if self.use_tls:
            context = ssl.create_default_context()
            with smtplib.SMTP(self.host, self.port, timeout=10) as server:
                server.starttls(context=context)
                if self.username and self.password:
                    server.login(self.username, self.password)
                server.send_message(message)
        else:
            with smtplib.SMTP(self.host, self.port, timeout=10) as server:
                if self.username and self.password:
                    server.login(self.username, self.password)
                server.send_message(message)


_email_service: Optional[EmailService] = None


def get_email_service() -> EmailService:
    global _email_service
    if _email_service is None:
        _email_service = EmailService()
    return _email_service
