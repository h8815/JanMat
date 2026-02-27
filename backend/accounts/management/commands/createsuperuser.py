from django.core.management.base import BaseCommand
from django.contrib.auth.hashers import make_password
from accounts.models import SuperAdmin
import getpass

class Command(BaseCommand):
    help = 'Creates a SuperAdmin user'

    def handle(self, *args, **options):
        self.stdout.write("Creating a new SuperAdmin...")
        
        username = input("Username: ").strip()
        while not username:
            self.stdout.write(self.style.ERROR("Username cannot be empty."))
            username = input("Username: ").strip()
            
        if SuperAdmin.objects.filter(username=username).exists():
            self.stdout.write(self.style.ERROR(f"Error: SuperAdmin with username '{username}' already exists."))
            return
            
        email = input("Email: ").strip()
        while not email:
            self.stdout.write(self.style.ERROR("Email cannot be empty."))
            email = input("Email: ").strip()
            
        if SuperAdmin.objects.filter(email=email).exists():
            self.stdout.write(self.style.ERROR(f"Error: SuperAdmin with email '{email}' already exists."))
            return

        name = input("Name (optional): ").strip()
        phone_number = input("Phone Number (optional): ").strip()
        
        password = getpass.getpass("Password: ")
        while not password:
            self.stdout.write(self.style.ERROR("Password cannot be empty."))
            password = getpass.getpass("Password: ")
            
        password_confirm = getpass.getpass("Password (again): ")
        if password != password_confirm:
            self.stdout.write(self.style.ERROR("Error: Passwords do not match."))
            return

        try:
            SuperAdmin.objects.create(
                username=username,
                email=email,
                password=make_password(password),
                name=name,
                phone_number=phone_number,
                is_active=True
            )
            self.stdout.write(self.style.SUCCESS(f"SuperAdmin '{username}' created successfully."))
        except Exception as e:
            self.stdout.write(self.style.ERROR(f"Error creating user: {e}"))
