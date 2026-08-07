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
    app_password = os.environ.get("EMAIL_APP_PASSWORD")
    
    if not sender_email or not app_password:
        print("❌ Email credentials missing from environment.")
        return False 
    
    msg = MIMEMultipart()
    msg['From'] = f"Project Veda <{sender_email}>"
    msg['To'] = recipient_email
    msg['Subject'] = "Your Project Veda Verification Code"
    
    body = f"Welcome to Project Veda!\n\nYour 6-digit secure verification code is: {otp_code}\n\nThis code is valid for 10 minutes."
    msg.attach(MIMEText(body, 'plain'))
    
    try:
        server = smtplib.SMTP('smtp.gmail.com', 587)
        server.starttls()
        server.login(sender_email, app_password)
        server.send_message(msg)
        server.quit()
        return True
    except Exception as e:
        print(f"Email delivery failed: {e}")
        return False