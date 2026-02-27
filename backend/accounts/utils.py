import threading
from django.core.mail import send_mail
from django.conf import settings
import logging

logger = logging.getLogger(__name__)

class EmailThread(threading.Thread):
    def __init__(self, subject, message, recipient_list, from_email=None, **kwargs):
        self.subject = subject
        self.message = message
        self.recipient_list = recipient_list
        self.from_email = from_email or settings.EMAIL_HOST_USER
        self.kwargs = kwargs
        threading.Thread.__init__(self)

    def run(self):
        try:
            send_mail(
                self.subject,
                self.message,
                self.from_email,
                self.recipient_list,
                **self.kwargs
            )
            logger.info(f"Background email sent successfully to {self.recipient_list}")
        except Exception as e:
            logger.error(f"Failed to send async email to {self.recipient_list}: {str(e)}")

def send_mail_async(subject, message, recipient_list, from_email=None, **kwargs):
    """
    Helper function to send email in a non-blocking background thread.
    """
    EmailThread(subject, message, recipient_list, from_email, **kwargs).start()
