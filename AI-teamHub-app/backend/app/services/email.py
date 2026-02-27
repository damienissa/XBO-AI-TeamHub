import logging
import os
import smtplib
from email.mime.text import MIMEText

logger = logging.getLogger(__name__)


def send_email(to: str, subject: str, body: str) -> None:
    """Send a plain-text email via SMTP. Silently swallows errors (non-critical path)."""
    host = os.getenv("SMTP_HOST", "")
    if not host:
        logger.debug("SMTP_HOST not configured — skipping email to %s", to)
        return

    port = int(os.getenv("SMTP_PORT", "587"))
    user = os.getenv("SMTP_USER", "")
    password = os.getenv("SMTP_PASSWORD", "")
    from_addr = os.getenv("SMTP_FROM", "noreply@xbo.com")

    try:
        msg = MIMEText(body, "plain", "utf-8")
        msg["Subject"] = subject
        msg["From"] = from_addr
        msg["To"] = to

        with smtplib.SMTP(host, port, timeout=10) as smtp:
            smtp.ehlo()
            smtp.starttls()
            if user and password:
                smtp.login(user, password)
            smtp.sendmail(from_addr, [to], msg.as_string())

        logger.info("Email sent to %s: %s", to, subject)
    except Exception as exc:
        logger.warning("Failed to send email to %s: %s", to, exc)
