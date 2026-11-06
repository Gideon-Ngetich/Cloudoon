import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

class EmailService:
    def __init__(self):
        pass

    def _get_config(self):
        env_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env")
        if os.path.exists(env_path):
            try:
                with open(env_path, "r", encoding="utf-8") as f:
                    for line in f:
                        line = line.strip()
                        if line and not line.startswith("#") and "=" in line:
                            k, v = line.split("=", 1)
                            os.environ[k.strip()] = v.strip().strip("'\"")
            except Exception:
                pass

        return {
            "host": os.environ.get("SMTP_HOST", "").strip(),
            "port": int(os.environ.get("SMTP_PORT", "587")),
            "user": os.environ.get("SMTP_USER", "").strip(),
            "password": os.environ.get("SMTP_PASSWORD", "").strip(),
            "from_email": os.environ.get("SMTP_FROM", "support@cloudoon.com").strip(),
            "secure": os.environ.get("SMTP_SECURE", "tls").strip().lower()
        }

    def send_otp_email(self, recipient_email: str, otp_code: str) -> dict:
        config = self._get_config()
        clean_recipient = recipient_email.strip().lower()

        subject = f"Your Cloudoon Security Code: {otp_code}"
        text_content = f"Hello,\n\nYour Cloudoon verification code is: {otp_code}\n\nThis code will expire in 10 minutes.\n\nCloudoon Security Team"

        html_content = f"""
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 32px 24px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff;">
            <div style="text-align: center; margin-bottom: 24px;">
                <h1 style="color: #395AF4; font-size: 26px; font-weight: 900; margin: 0; letter-spacing: -0.5px;">Cloudoon<span style="color: #E7A403;">.</span></h1>
                <p style="color: #64748b; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; margin-top: 6px;">Email Verification</p>
            </div>
            <div style="color: #1e293b; font-size: 15px; line-height: 1.6;">
                <p style="margin-top: 0;">Hello,</p>
                <p>Please enter the following 6-digit one-time passcode to verify your email address and access your Cloudoon cloud hosting dashboard:</p>
            </div>
            <div style="background: #eff3ff; border: 2px dashed #395AF4; border-radius: 12px; padding: 20px; text-align: center; margin: 28px 0;">
                <span style="font-size: 36px; font-weight: 900; letter-spacing: 8px; color: #395AF4; font-family: monospace;">{otp_code}</span>
            </div>
            <p style="color: #64748b; font-size: 12px; line-height: 1.5; margin-bottom: 24px;">
                This code is confidential and expires in 10 minutes. If you did not make this request, you can safely disregard this email.
            </p>
            <div style="border-top: 1px solid #f1f5f9; padding-top: 20px; text-align: center; color: #94a3b8; font-size: 11px;">
                &copy; 2026 Cloudoon Inc. All rights reserved. &bull; Nairobi, Kenya
            </div>
        </div>
        """

        if config["host"] and config["user"] and config["password"]:
            try:
                msg = MIMEMultipart("alternative")
                msg["Subject"] = subject
                msg["From"] = f"Cloudoon Security <{config['from_email']}>"
                msg["To"] = clean_recipient
                msg.attach(MIMEText(text_content, "plain"))
                msg.attach(MIMEText(html_content, "html"))

                if config["port"] == 465 or config["secure"] == "ssl":
                    server = smtplib.SMTP_SSL(config["host"], config["port"], timeout=12)
                else:
                    server = smtplib.SMTP(config["host"], config["port"], timeout=12)
                    server.starttls()

                server.login(config["user"], config["password"])
                server.sendmail(config["from_email"], [clean_recipient], msg.as_string())
                server.quit()

                return {
                    "success": True,
                    "mode": "smtp",
                    "otp": otp_code,
                    "message": f"Verification email successfully sent to {clean_recipient} via SMTP."
                }
            except Exception as e:
                return {
                    "success": True,
                    "mode": "simulated",
                    "otp": otp_code,
                    "error": str(e),
                    "message": f"SMTP dispatch failed ({str(e)}). Code generated for {clean_recipient}."
                }

        return {
            "success": True,
            "mode": "simulated",
            "otp": otp_code,
            "message": f"Verification code generated for {clean_recipient}. (Configure SMTP credentials in .env to dispatch real mail)."
        }
