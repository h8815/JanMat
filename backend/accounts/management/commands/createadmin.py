from django.core.management.base import BaseCommand
from django.contrib.auth.hashers import make_password
from accounts.models import Admin, SuperAdmin
import getpass

class Command(BaseCommand):
    help = 'Creates an Admin user'

    def handle(self, *args, **options):
        self.stdout.write("Creating a new Admin...")
        
        # Verify valid SuperAdmins exist
        if not SuperAdmin.objects.exists():
            self.stdout.write(self.style.ERROR("Error: No SuperAdmins exist. Please create a SuperAdmin first using 'createsuperuser'."))
            return

        super_email = input("Enter Owner SuperAdmin Email: ").strip()
        try:
            super_admin = SuperAdmin.objects.get(email__iexact=super_email)
        except SuperAdmin.DoesNotExist:
             self.stdout.write(self.style.ERROR(f"Error: SuperAdmin '{super_email}' not found."))
             return

        email = input("Admin Email: ").strip()
        while not email:
            self.stdout.write(self.style.ERROR("Email cannot be empty."))
            email = input("Admin Email: ").strip()
            
        if Admin.objects.filter(email=email).exists():
            self.stdout.write(self.style.ERROR(f"Error: Admin with email '{email}' already exists."))
            return

        name = input("Name (optional): ").strip()
        
        password = getpass.getpass("Password: ")
        while not password:
            self.stdout.write(self.style.ERROR("Password cannot be empty."))
            password = getpass.getpass("Password: ")
            
        password_confirm = getpass.getpass("Password (again): ")
        if password != password_confirm:
            self.stdout.write(self.style.ERROR("Error: Passwords do not match."))
            return

        try:
            Admin.objects.create(
                email=email,
                password=make_password(password),
                name=name,
                created_by=super_admin,
                is_active=True
            )
            self.stdout.write(self.style.SUCCESS(f"Admin '{email}' created successfully under SuperAdmin '{super_admin.email}'."))
        except Exception as e:
            self.stdout.write(self.style.ERROR(f"Error creating user: {e}"))
