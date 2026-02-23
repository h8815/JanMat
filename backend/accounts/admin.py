from django.contrib import admin
from django.contrib.auth.hashers import make_password
from django.core.mail import send_mail
from django.conf import settings
from .models import SuperAdmin, Admin, Operator
import string
import secrets
import logging

logger = logging.getLogger(__name__)

def generate_temp_password(length=12):
    alphabet = string.ascii_letters + string.digits + "!@#$%^&*"
    while True:
        pwd = ''.join(secrets.choice(alphabet) for i in range(length))
        if (any(c.islower() for c in pwd) and 
            any(c.isupper() for c in pwd) and 
            any(c.isdigit() for c in pwd) and 
            any(c in "!@#$%^&*" for c in pwd)):
            return pwd

@admin.register(SuperAdmin)
class SuperAdminAdmin(admin.ModelAdmin):
    list_display = ('email', 'name', 'is_active', 'created_at')
    search_fields = ('email', 'name')
    
    def get_queryset(self, request):
        qs = super().get_queryset(request)
        # Each SuperAdmin can only see their own record
        if hasattr(request.user, 'super_admin_profile'):
            return qs.filter(id=request.user.super_admin_profile.id)
        return qs

    exclude = ('password',)

    def has_delete_permission(self, request, obj=None):
        # Prevent SuperAdmin from deleting any SuperAdmin (including self) via admin panel
        return False

    def save_model(self, request, obj, form, change):
        is_new = not change
        temp_pwd = None
        
        if is_new:
            temp_pwd = generate_temp_password()
            obj.password = make_password(temp_pwd)
            obj.must_change_password = True

        super().save_model(request, obj, form, change)

        # Distribute Credentials via Email
        if is_new and temp_pwd:
            subject = 'Welcome to JanMat - SuperAdmin Credentials'
            message = f'''Hello {obj.name or 'SuperAdmin'},

A SuperAdmin account has been created for you on the JanMat portal.

Your login details:
Username: {obj.username or obj.email}
Temporary Password: {temp_pwd}

Please log in to the portal where you will be prompted to change your password immediately.

Regards,
JanMat System'''
            try:
                send_mail(subject, message, settings.EMAIL_HOST_USER, [obj.email], fail_silently=True)
            except Exception as e:
                logger.error(f"Failed to send welcome email to {obj.email}: {e}")

@admin.register(Admin)
class AdminAdmin(admin.ModelAdmin):
    list_display = ('email', 'name', 'created_by', 'is_active')
    search_fields = ('email', 'name')
    list_filter = ('created_by',)
    
    exclude = ('password',)
    
    def get_queryset(self, request):
        qs = super().get_queryset(request)
        # Isolation: Only show Admins created by this SuperAdmin
        if hasattr(request.user, 'super_admin_profile'):
            return qs.filter(created_by=request.user.super_admin_profile)
        return qs

    def save_model(self, request, obj, form, change):
        is_new = not change
        
        # Auto-assign created_by
        if not change and hasattr(request.user, 'super_admin_profile'):
            obj.created_by = request.user.super_admin_profile
            
        temp_pwd = None
        if is_new:
            temp_pwd = generate_temp_password()
            obj.password = make_password(temp_pwd)
            obj.must_change_password = True
            
        super().save_model(request, obj, form, change)
        
        # Distribute Credentials via Email
        if is_new and temp_pwd:
            subject = 'Welcome to JanMat - Admin Credentials'
            message = f'''Hello {obj.name or 'Admin'},

An administrator account has been created for you on the JanMat portal by your SuperAdmin.

Your login details:
Username: {obj.username or obj.email}
Temporary Password: {temp_pwd}

Please log in to the portal where you will be prompted to change your password immediately.

Regards,
JanMat System'''
            try:
                send_mail(subject, message, settings.EMAIL_HOST_USER, [obj.email], fail_silently=True)
            except Exception as e:
                logger.error(f"Failed to send welcome email to {obj.email}: {e}")

@admin.register(Operator)
class OperatorAdmin(admin.ModelAdmin):
    list_display = ('email', 'name', 'booth_id', 'created_by', 'is_active')
    search_fields = ('email', 'name', 'booth_id')
    list_filter = ('created_by', 'booth_id')
    
    exclude = ('password',)
    
    def get_queryset(self, request):
        qs = super().get_queryset(request)
        # Isolation: Only show Operators belonging to Admins created by this SuperAdmin
        if hasattr(request.user, 'super_admin_profile'):
            return qs.filter(created_by__created_by=request.user.super_admin_profile)
        return qs
    
    def formfield_for_foreignkey(self, db_field, request, **kwargs):
        if db_field.name == "created_by":
             # Only allow assigning to Admins created by this SuperAdmin
             if hasattr(request.user, 'super_admin_profile'):
                 kwargs["queryset"] = Admin.objects.filter(created_by=request.user.super_admin_profile)
        return super().formfield_for_foreignkey(db_field, request, **kwargs)

    def save_model(self, request, obj, form, change):
        is_new = not change
        temp_pwd = None
        
        if is_new:
            temp_pwd = generate_temp_password()
            obj.password = make_password(temp_pwd)
            obj.must_change_password = True
            
        super().save_model(request, obj, form, change)
        
        # Distribute Credentials via Email
        if is_new and temp_pwd:
            subject = 'Welcome to JanMat - Operator Credentials'
            message = f'''Hello {obj.name or 'Operator'},

An Operator account has been created for you on the JanMat portal for Booth ID: {obj.booth_id or 'N/A'}.

Your login details:
Username: {obj.username or obj.email}
Temporary Password: {temp_pwd}

Please log in to the portal where you will be prompted to change your password immediately.

Regards,
JanMat System'''
            try:
                send_mail(subject, message, settings.EMAIL_HOST_USER, [obj.email], fail_silently=True)
            except Exception as e:
                logger.error(f"Failed to send welcome email to {obj.email}: {e}")