import threading
from django.core.mail import EmailMultiAlternatives
from django.core.mail.message import make_msgid
from email.mime.image import MIMEImage
from django.conf import settings
import logging
import os
import string
import secrets
import re

logger = logging.getLogger(__name__)

def get_shortform(text):
    """
    Extracts a shortform from geographic names (e.g., Uttar Pradesh -> up).
    """
    if not text:
        return "xx"
    text = text.lower().strip()
    state_map = {
        'uttar pradesh': 'up', 'rajasthan': 'rj', 'maharashtra': 'mh',
        'madhya pradesh': 'mp', 'andhra pradesh': 'ap', 'arunachal pradesh': 'ar',
        'himachal pradesh': 'hp', 'west bengal': 'wb', 'tamil nadu': 'tn',
        'jammu and kashmir': 'jk',
    }
    if text in state_map:
        return state_map[text]
    words = re.findall(r'[a-z]+', text)
    if not words: return "xx"
    if len(words) == 1: return words[0][:3]
    return "".join(word[0] for word in words)[:3]

def generate_temp_password(length=12):
    """Generates a secure temporary password."""
    alphabet = string.ascii_letters + string.digits + "!@#$%^&*"
    while True:
        pwd = ''.join(secrets.choice(alphabet) for i in range(length))
        if (any(c.islower() for c in pwd) and any(c.isupper() for c in pwd) and 
            any(c.isdigit() for c in pwd) and any(c in "!@#$%^&*" for c in pwd)):
            return pwd

class EmailThread(threading.Thread):
    def __init__(self, subject, message, recipient_list, from_email=None, html_message=None, attachments=None, **kwargs):
        self.subject = subject
        self.message = message
        self.recipient_list = recipient_list
        self.from_email = from_email or settings.DEFAULT_FROM_EMAIL
        self.html_message = html_message
        self.attachments = attachments or {}
        self.kwargs = kwargs
        threading.Thread.__init__(self)

    def run(self):
        try:
            msg = EmailMultiAlternatives(
                self.subject, self.message, self.from_email, self.recipient_list, **self.kwargs
            )
            if self.html_message:
                for cid, path in self.attachments.items():
                    if os.path.exists(path):
                        with open(path, 'rb') as f:
                            msg_img = MIMEImage(f.read())
                            msg_img.add_header('Content-ID', f'<{cid}>')
                            msg_img.add_header('Content-Disposition', 'inline', filename=os.path.basename(path))
                            msg.attach(msg_img)
                msg.attach_alternative(self.html_message, "text/html")
            msg.send()
            logger.info(f"Email sent to {self.recipient_list}")
        except Exception as e:
            logger.error(f"Email failed: {str(e)}")

def send_mail_async(subject, message, recipient_list, from_email=None, html_message=None, attachments=None, **kwargs):
    EmailThread(subject, message, recipient_list, from_email, html_message, attachments, **kwargs).start()

def get_welcome_email_template(obj_name, role, username, temp_pwd, creator_email, creator_phone, booth_id=None):
    """
    Detailed Welcome/Credential Template (Bilingual)
    """
    booth_text = f"Your account is ready for Booth {booth_id}." if booth_id else f"Your account as {role} has been established."
    message = f"Welcome to JanMat, {obj_name}!\n\n{booth_text}\nUsername: {username}\nInitial Password: {temp_pwd}\n\nSupport: {creator_email}"
    
    booth_html_en = f'<p style="font-size: 15px; color: #00234B; font-weight: 700;">Deployment: Booth {booth_id}</p>' if booth_id else ""
    booth_html_hi = f'<p style="font-size: 16px; color: #00234B; font-weight: 700;">तैनाती: बूथ {booth_id}</p>' if booth_id else ""
    
    html_message = f'''
    <div style="font-family: 'Inter', system-ui, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #E5E7EB; background: #FFFFFF; color: #111827; line-height: 1.6;">
        <!-- Header -->
        <div style="width: 100%; border-bottom: 2px solid #00234B;">
            <img src="cid:logo" alt="JanMat Portal" style="width: 100%; display: block;">
        </div>

        <div style="padding: 40px 30px;">
            <!-- English Section -->
            <div style="margin-bottom: 45px;">
                <h2 style="color: #00234B; font-size: 22px; font-weight: 800; text-transform: uppercase; margin-top: 0; letter-spacing: 0.02em;">Account Authorization Notice</h2>
                <p style="font-size: 15px;">Greetings <strong>{obj_name}</strong>,</p>
                <p style="font-size: 15px;">An administrative account has been established for you as a <strong>{role}</strong> within the JanMat Infrastructure. You are now authorized to access the secure administrative dashboard.</p>
                {booth_html_en}
                
                <div style="background: #F8FAFC; border: 1.5px solid #00234B; padding: 25px; margin: 30px 0;">
                    <p style="margin: 0 0 15px 0; font-weight: 900; font-size: 11px; text-transform: uppercase; color: #00234B; letter-spacing: 0.1em;">Institutional Credentials</p>
                    <p style="margin: 10px 0; font-size: 16px;"><strong>Username:</strong> <code style="color: #2563EB; font-weight: 700;">{username}</code></p>
                    <p style="margin: 10px 0; font-size: 16px;"><strong>Access Key:</strong> <code style="color: #2563EB; font-weight: 700;">{temp_pwd}</code></p>
                </div>

                <p style="font-size: 14px; color: #4B5563;"><strong>Next Steps:</strong> Please navigate to your portal and initialize your session. You will be prompted to set a permanent password upon first entry.</p>
            </div>

            <hr style="border: 0; border-top: 1px solid #E5E7EB; margin: 40px 0;">

            <!-- Hindi Section -->
            <div style="direction: ltr;">
                <h2 style="color: #00234B; font-size: 20px; font-weight: 800; margin-top: 0;">खाता प्राधिकरण सूचना</h2>
                <p style="font-size: 16px;">नमस्ते <strong>{obj_name}</strong>,</p>
                <p style="font-size: 16px;">जनमत इन्फ्रास्ट्रक्चर के भीतर <strong>{role}</strong> के रूप में आपके लिए एक प्रशासनिक खाता स्थापित किया गया है। अब आप सुरक्षित प्रशासनिक डैशबोर्ड तक पहुँचने के लिए अधिकृत हैं।</p>
                {booth_html_hi}
                
                <div style="background: #F8FAFC; border: 1.5px solid #00234B; padding: 25px; margin: 30px 0;">
                    <p style="margin: 10px 0; font-size: 16px;"><strong>यूज़रनेम:</strong> <code style="color: #2563EB; font-weight: 700;">{username}</code></p>
                    <p style="margin: 10px 0; font-size: 16px;"><strong>एक्सेस की (पासवर्ड):</strong> <code style="color: #2563EB; font-weight: 700;">{temp_pwd}</code></p>
                </div>
                <p style="font-size: 15px; color: #4B5563;"><strong>अगले कदम:</strong> कृपया अपने पोर्टल पर जाएं और अपना सत्र शुरू करें। आपको पहली बार प्रवेश करने पर एक स्थायी पासवर्ड सेट करने के लिए कहा जाएगा।</p>
            </div>

            <!-- Login Action -->
            <div style="margin-top: 50px; text-align: center;">
                <a href="https://janmat.cybrmoon.space" style="background: #00234B; color: #FFFFFF; padding: 15px 35px; text-decoration: none; font-weight: 900; font-size: 13px; text-transform: uppercase; letter-spacing: 0.15em; display: inline-block;">
                    Authorized Portal Login
                </a>
            </div>
        </div>

        <!-- Footer / Support -->
        <div style="background: #1A1A1B; color: #9CA3AF; padding: 35px 30px; font-size: 12px; border-top: 4px solid #00234B;">
            <div style="margin-bottom: 20px;">
                <p style="margin: 0; color: #FFFFFF; font-weight: 800; text-transform: uppercase; letter-spacing: 0.1em; font-size: 13px;">Technical Support Protocol</p>
                <p style="margin: 10px 0;">For technical assistance or access issues, contact your regional administrator:</p>
                <p style="margin: 5px 0;"><strong>Email:</strong> {creator_email}</p>
                <p style="margin: 5px 0;"><strong>Terminal:</strong> {creator_phone}</p>
            </div>
            <div style="padding-top: 20px; border-top: 1px solid #374151; text-align: center; color: #6B7280;">
                <p style="margin: 0;">© ELECTION COMMISSION OF INDIA • 2026</p>
                <p style="margin: 5px 0; font-size: 10px; text-transform: uppercase; letter-spacing: 0.2em;">Protected by Federal Encryption Standards</p>
            </div>
        </div>
    </div>
    '''
    return message, html_message

def get_password_reset_email_template(obj_name, role, username, temp_pwd, creator_email='admin@janmat.gov.in', creator_phone='N/A'):
    """
    Detailed Password Reset Template (Bilingual)
    """
    message = f"JanMat Password Recovery: {obj_name}\n\nTemporary credentials have been generated.\nUsername: {username}\nTemp Password: {temp_pwd}"
    
    html_message = f'''
    <div style="font-family: 'Inter', system-ui, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #FCA5A5; background: #FFFFFF; color: #111827; line-height: 1.6;">
        <!-- Header -->
        <div style="width: 100%; border-bottom: 2px solid #DC2626;">
            <img src="cid:logo" alt="JanMat Recovery" style="width: 100%; display: block;">
        </div>

        <div style="padding: 40px 30px;">
            <!-- English Section -->
            <div style="margin-bottom: 45px;">
                <h2 style="color: #DC2626; font-size: 22px; font-weight: 800; text-transform: uppercase; margin-top: 0; letter-spacing: 0.02em;">Recovery Protocol Initiated</h2>
                <p style="font-size: 15px;">Attention <strong>{obj_name}</strong>,</p>
                <p style="font-size: 15px;">A request for password recovery has been processed for your <strong>{role}</strong> credentials. Access has been restored using a temporary security key.</p>
                
                <div style="background: #FEF2F2; border: 1.5px solid #DC2626; padding: 25px; margin: 30px 0;">
                    <p style="margin: 0 0 15px 0; font-weight: 900; font-size: 11px; text-transform: uppercase; color: #7F1D1D; letter-spacing: 0.1em;">Temporary Access Key</p>
                    <p style="margin: 10px 0; font-size: 16px;"><strong>Username:</strong> <code style="color: #991B1B; font-weight: 700;">{username}</code></p>
                    <p style="margin: 10px 0; font-size: 16px;"><strong>Temp Password:</strong> <code style="color: #991B1B; font-weight: 700;">{temp_pwd}</code></p>
                </div>

                <p style="font-size: 14px; color: #991B1B;"><strong>URGENT:</strong> Change your password immediately upon logging in. If you did not request this, secure your account and contact support at once.</p>
            </div>

            <hr style="border: 0; border-top: 1px solid #FEE2E2; margin: 40px 0;">

            <!-- Hindi Section -->
            <div style="direction: ltr;">
                <h2 style="color: #DC2626; font-size: 20px; font-weight: 800; margin-top: 0;">रिकवरी प्रोटोकॉल शुरू</h2>
                <p style="font-size: 16px;">ध्यान दें <strong>{obj_name}</strong>,</p>
                <p style="font-size: 16px;">आपके <strong>{role}</strong> क्रेडेंशियल्स के लिए पासवर्ड रिकवरी का अनुरोध संसाधित किया गया है। एक अस्थायी सुरक्षा कूंजी का उपयोग करके पहुंच बहाल कर दी गई है।</p>
                
                <div style="background: #FEF2F2; border: 1.5px solid #DC2626; padding: 25px; margin: 30px 0;">
                    <p style="margin: 10px 0; font-size: 16px;"><strong>यूज़रनेम:</strong> <code style="color: #991B1B; font-weight: 700;">{username}</code></p>
                    <p style="margin: 10px 0; font-size: 16px;"><strong>अस्थायी पासवर्ड:</strong> <code style="color: #991B1B; font-weight: 700;">{temp_pwd}</code></p>
                </div>
                <p style="font-size: 15px; color: #991B1B;"><strong>जरूरी:</strong> लॉग इन करने के बाद तुरंत अपना पासवर्ड बदलें। यदि आपने इसका अनुरोध नहीं किया है, तो तुरंत अपने खाते को सुरक्षित करें और सहायता से संपर्क करें।</p>
            </div>

            <!-- Login Action -->
            <div style="margin-top: 50px; text-align: center;">
                <a href="https://janmat.cybrmoon.space" style="background: #DC2626; color: #FFFFFF; padding: 15px 35px; text-decoration: none; font-weight: 900; font-size: 13px; text-transform: uppercase; letter-spacing: 0.15em; display: inline-block;">
                    Secure Emergency Login
                </a>
            </div>
        </div>

        <!-- Footer / Support -->
        <div style="background: #1A1A1B; color: #9CA3AF; padding: 35px 30px; font-size: 12px; border-top: 4px solid #DC2626;">
            <div style="margin-bottom: 20px;">
                <p style="margin: 0; color: #FFFFFF; font-weight: 800; text-transform: uppercase; letter-spacing: 0.1em; font-size: 13px;">Security Support Protocol</p>
                <p style="margin: 10px 0;">Contact the JanMat Security Desk for priority assistance:</p>
                <p style="margin: 5px 0;"><strong>Email:</strong> {creator_email}</p>
                <p style="margin: 5px 0;"><strong>Phone:</strong> {creator_phone}</p>
            </div>
            <div style="padding-top: 20px; border-top: 1px solid #374151; text-align: center; color: #6B7280;">
                <p style="margin: 0;">© ELECTION COMMISSION OF INDIA • 2026</p>
                <p style="margin: 5px 0; font-size: 10px; text-transform: uppercase; letter-spacing: 0.2em;">Emergency Security Response Deployment</p>
            </div>
        </div>
    </div>
    '''
    return message, html_message
