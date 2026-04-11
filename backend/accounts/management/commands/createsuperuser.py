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

        # ── Create account ────────────────────────────────────────────────────
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
            self.stdout.write(self.style.ERROR(f'Failed to create account: {exc}'))
            return

        # ── Send credentials email ────────────────────────────────────────────
        try:
            subject = 'Welcome to JanMat — SuperAdmin Credentials'
            message, html_message = get_welcome_email_template(
                obj_name=name,
                role='SuperAdmin',
                username=username,
                temp_pwd=temp_password,
                creator_email='System',
                creator_phone='N/A',
            )
            self.stdout.write(self.style.SUCCESS(
                f'\n✔  SuperAdmin created successfully.'
            ))
            self.stdout.write(f'   Username : {username}')
            self.stdout.write(f'   Email    : {email}')
            self.stdout.write(
                self.style.WARNING(
                    '   The account requires a password change on first login.\n'
                )
            )

            self.stdout.write(
                self.style.NOTICE(
                    f'   [i] Sending credentials to {email} via secure SMTP...'
                )
            )
            # Create attachments
            attachments = {
                'logo': os.path.join(settings.BASE_DIR, 'static', 'assets', 'images', 'mail.png')
            }
            # Start email thread
            send_mail_async(
                subject,
                message,
                [email],
                html_message=html_message,
                attachments=attachments,
            )
            self.stdout.write(
                self.style.NOTICE(
                    '   [i] Email thread dispatched. Awaiting final SMTP handshake before exiting terminal...'
                )
            )
        except Exception as exc:
            # Account was created; warn but don't fail
            self.stdout.write(self.style.WARNING(
                f'Account created but email failed: {exc}\n'
                f'Temporary password: {temp_password}\n'
                f'Username: {username}'
            ))
