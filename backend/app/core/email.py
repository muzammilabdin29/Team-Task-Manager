import smtplib
from email.message import EmailMessage
from app.core.config import settings


def send_otp_email(to_email: str, otp_code: str) -> bool:
    """Sends an OTP code via email using SMTP."""
    if not settings.SMTP_USER or not settings.SMTP_PASSWORD:
        print(f"WARNING: SMTP credentials not set. Would have sent OTP {otp_code} to {to_email}")
        # In development, you might want to return True here to allow testing
        # without SMTP configured, but we'll print it to console.
        return True

    msg = EmailMessage()
    msg.set_content(
        f"Hello,\n\n"
        f"Your registration OTP for TaskFlow is: {otp_code}\n\n"
        f"This code will expire in {settings.OTP_EXPIRE_MINUTES} minutes.\n\n"
        f"If you did not request this, please ignore this email."
    )
    msg["Subject"] = "Your TaskFlow Registration OTP"
    msg["From"] = settings.EMAILS_FROM
    msg["To"] = to_email

    try:
        server = smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT)
        server.starttls()
        server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
        server.send_message(msg)
        server.quit()
        return True
    except Exception as e:
        print(f"Failed to send email: {e}")
        return False
