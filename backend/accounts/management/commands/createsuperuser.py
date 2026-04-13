import os
import random
import string

from django.conf import settings
from django.contrib.auth.hashers import make_password
from django.core.management.base import BaseCommand

from accounts.models import SuperAdmin
from accounts.utils import send_mail_async, get_welcome_email_template


def _generate_suffix(length=5):
    """Return a random alphanumeric suffix of given length (uppercase)."""
    chars = string.ascii_uppercase + string.digits
    return ''.join(random.choices(chars, k=length))


def _build_username(name):
    """
    Build a unique username of the form:
        super.<first-word-of-name>.<SUFFIX>.janmat.gov.in
    e.g.  super.rajesh.X9K2M.janmat.gov.in
    """
    safe_name = ''.join(filter(str.isalnum, (name or 'superadmin').split()[0].lower()))
    for _ in range(20):          # try up to 20 times before giving up
        suffix = _generate_suffix(5)
        candidate = f"super.{safe_name}.{suffix}.janmat.gov.in"
        if not SuperAdmin.objects.filter(username=candidate).exists():
            return candidate
    raise RuntimeError("Could not generate a unique username after 20 attempts.")


def _generate_password(length=14):
    """Return a strong random password."""
    alphabet = string.ascii_letters + string.digits + '!@#$%^&*'
    while True:
        pwd = ''.join(random.choices(alphabet, k=length))
        # Enforce at least one uppercase, one digit, one special char
        if (any(c.isupper() for c in pwd) and
                any(c.isdigit() for c in pwd) and
                any(c in '!@#$%^&*' for c in pwd)):
            return pwd


class Command(BaseCommand):
    help = (
        'Create a SuperAdmin account. '
        'Prompts only for Email, Name, and Phone Number. '
        'Username and password are auto-generated and emailed to the provided address.'
    )

    def handle(self, *args, **options):
        self.stdout.write(self.style.MIGRATE_HEADING(
            '\n=== JanMat — Create SuperAdmin ===\n'
        ))

        # ── 1. Email ──────────────────────────────────────────────────────────
        email = ''
        while not email:
            email = input('Email: ').strip().lower()
            if not email:
                self.stdout.write(self.style.ERROR('Email cannot be empty.'))
                email = ''
                continue
            if SuperAdmin.objects.filter(email__iexact=email).exists():
                self.stdout.write(self.style.ERROR(
                    f"A SuperAdmin with email '{email}' already exists."
                ))
                return

        # ── 2. Name ───────────────────────────────────────────────────────────
        name = ''
        while not name:
            name = input('Full Name: ').strip()
            if not name:
                self.stdout.write(self.style.ERROR('Name cannot be empty.'))

        # ── 3. Phone Number ───────────────────────────────────────────────────
        phone_number = input('Phone Number: ').strip()

        # ── Auto-generate username & password ─────────────────────────────────
        try:
            username = _build_username(name)
        except RuntimeError as exc:
            self.stdout.write(self.style.ERROR(str(exc)))
            return

        temp_password = _generate_password()

        # ── Create account and Send Email ─────────────────────────────────────
        try:
            superadmin = SuperAdmin.objects.create(
                username=username,
                email=email,
                password=make_password(temp_password),
                name=name,
                phone_number=phone_number,
                is_active=True,
                must_change_password=True,
            )
        except Exception as exc:
            self.stdout.write(self.style.ERROR(f'\nERROR: Failed to establish SuperAdmin account.'))
            self.stdout.write(self.style.ERROR(f'Reason: {exc}'))
            return

        def rollback_user():
            # Background callback executing if SMTP thread fails
            try:
                SuperAdmin.objects.filter(username=username).delete()
                print(f"\n[!] SMTP delivery failed. SuperAdmin data for '{username}' was safely wiped from the database.")
            except Exception as e:
                print(f"\n[?] Warning: Could not cleanly roll back user '{username}': {e}")

        # ── Send credentials email ────────────────────────────────────────────
        subject = 'Welcome to JanMat — SuperAdmin Credentials'
        message, html_message = get_welcome_email_template(
            obj_name=name,
            role='SuperAdmin',
            username=username,
            temp_pwd=temp_password,
            creator_email='System',
            creator_phone='N/A',
        )
        
        self.stdout.write(
            self.style.NOTICE(
                f'   [i] Sending credentials to {email} via secure SMTP (background dispatch)...'
            )
        )
        
        # Create attachments
        attachments = {
            'logo': os.path.join(settings.BASE_DIR, 'static', 'assets', 'images', 'mail.png')
        }
        
        # Dispatch asynchronously to return prompt quickly, but pass rollback callback
        send_mail_async(
            subject,
            message,
            [email],
            html_message=html_message,
            attachments=attachments,
            on_failure=rollback_user
        )

        # Print success immediately while thread processes
        self.stdout.write(self.style.SUCCESS(
            f'\n✔  SuperAdmin setup initiated successfully.'
        ))
        self.stdout.write(f'   Username : {username}')
        self.stdout.write(f'   Email    : {email}')
        self.stdout.write(
            self.style.WARNING(
                '   The account requires a password change on first login.\n'
            )
        )
