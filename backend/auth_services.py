import requests
import os
import string
import secrets
import smtplib
import bcrypt
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

def hash_password(password: str) -> str:
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))

def generate_otp(length=6) -> str:
    return ''.join(secrets.choice(string.digits) for _ in range(length))


def send_otp_email(recipient_email: str, otp_code: str) -> bool:
    sender_email = os.environ.get("EMAIL_ADDRESS")
    api_key = os.environ.get("BREVO_API_KEY")
    
    if not sender_email or not api_key:
        print("❌ Email credentials missing from environment.")
        return False 
    
    # Send via HTTPS to bypass Render's SMTP block
    url = "https://api.brevo.com/v3/smtp/email"
    headers = {
        "accept": "application/json",
        "api-key": api_key,
        "content-type": "application/json"
    }
    payload = {
        "sender": {"name": "Project Veda", "email": sender_email},
        "to": [{"email": recipient_email}],
        "subject": "Your Project Veda Verification Code",
        "textContent": f"Welcome to Project Veda!\n\nYour 6-digit secure verification code is: {otp_code}\n\nThis code is valid for 10 minutes."
    }
    
    try:
        response = requests.post(url, headers=headers, json=payload)
        # Brevo returns 201 Created on success
        if response.status_code in [200, 201, 202]:
            return True
        else:
            print(f"Brevo API Error: {response.text}")
            return False
    except Exception as e:
        print(f"Email delivery failed: {e}")
        return False