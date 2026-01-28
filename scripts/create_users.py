#!/usr/bin/env python
"""
JanMat User Creation Script
Run this to create admin and operator users
"""

import os
import sys
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'janmat_backend.settings')
django.setup()

from accounts.models import User, Operator

def create_admin():
    """Create admin user"""
    admin_email = "admin@janmat.gov.in"
    admin_password = "Admin@123456"
    
    if User.objects.filter(email=admin_email).exists():
        print(f"✅ Admin user {admin_email} already exists")
        return User.objects.get(email=admin_email)
    
    admin = User.objects.create_user(
        email=admin_email,
        password=admin_password,
        name="System Administrator",
        role="ADMIN",
        is_superuser=True
    )
    print(f"✅ Created admin user: {admin_email} / {admin_password}")
    return admin

def create_operator(admin_user):
    """Create operator user"""
    operator_email = "operator@janmat.gov.in"
    operator_password = "Operator@123456"
    
    if User.objects.filter(email=operator_email).exists():
        print(f"✅ Operator user {operator_email} already exists")
        return
    
    # Create operator user
    operator_user = User.objects.create_user(
        email=operator_email,
        password=operator_password,
        name="Booth Operator",
        role="OPERATOR",
        admin=admin_user,
        must_change_password=True
    )
    
    # Create operator profile
    operator = Operator.objects.create(
        user=operator_user,
        full_name="Booth Operator",
        booth_id="BOOTH-001",
        admin=admin_user
    )
    
    print(f"✅ Created operator user: {operator_email} / {operator_password}")
    print(f"✅ Created operator profile: Booth {operator.booth_id}")

if __name__ == "__main__":
    print("🚀 Creating JanMat users...")
    
    # Create admin
    admin = create_admin()
    
    # Create operator
    create_operator(admin)
    
    print("\n🎉 Setup complete!")
    print("\n📋 Login Credentials:")
    print("=" * 50)
    print("ADMIN LOGIN:")
    print("  URL: http://localhost/admin-login.html")
    print("  Email: admin@janmat.gov.in")
    print("  Password: Admin@123456")
    print()
    print("OPERATOR LOGIN:")
    print("  URL: http://localhost/operator-login.html")
    print("  Email: operator@janmat.gov.in")
    print("  Password: Operator@123456")
    print("  (Must change password on first login)")
    print("=" * 50)