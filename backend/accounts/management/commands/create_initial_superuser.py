from django.core.management.base import BaseCommand
from django.contrib.auth.hashers import make_password
from accounts.models import SuperAdmin

class Command(BaseCommand):
    help = 'Creates an initial SuperAdmin user'

    def handle(self, *args, **options):
        email = 'admin@janmat.gov.in'
        password = 'admin'
        
        if SuperAdmin.objects.filter(email=email).exists():
            self.stdout.write(self.style.WARNING(f'SuperAdmin {email} already exists'))
            return

        SuperAdmin.objects.create(
            email=email,
            password=make_password(password),
            name='Chief Election Commissioner',
            is_active=True
        )
        self.stdout.write(self.style.SUCCESS(f'Successfully created SuperAdmin: {email}'))
