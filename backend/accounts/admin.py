from django.contrib import admin
from django.contrib import messages
from django.contrib.auth.hashers import make_password
from django.conf import settings
from .models import SuperAdmin, Admin, Operator
from .utils import send_mail_async
import string
import secrets
import logging
from django.urls import path, reverse
from django.utils.html import format_html
from django.shortcuts import redirect
import logging

import re

logger = logging.getLogger(__name__)

def get_shortform(text):
    """
    Extracts a shortform from geographic names (e.g., Uttar Pradesh -> up, Rajasthan -> rj).
    If it's a known state, return its specific code.
    Otherwise, take the first letter of each word. If it's a single word, take the first 3 letters.
    """
    if not text:
        return "xx"
        
    text = text.lower().strip()
    
    # Common state abbreviations
    state_map = {
        'uttar pradesh': 'up',
        'rajasthan': 'rj',
        'maharashtra': 'mh',
        'madhya pradesh': 'mp',
        'andhra pradesh': 'ap',
        'arunachal pradesh': 'ar',
        'himachal pradesh': 'hp',
        'west bengal': 'wb',
        'tamil nadu': 'tn',
        'jammu and kashmir': 'jk',
    }
    
    if text in state_map:
        return state_map[text]
        
    # Standard fallback
    words = re.findall(r'[a-z]+', text)
    if not words:
        return "xx" # Default if no words found
       # If single word, take up to first 3 letters
    if len(words) == 1:
        return words[0][:3]
        
    # If multiple words, take first letter of each (up to 3)
    return "".join(word[0] for word in words)[:3]

def generate_temp_password(length=12):
    alphabet = string.ascii_letters + string.digits + "!@#$%^&*"
    while True:
        pwd = ''.join(secrets.choice(alphabet) for i in range(length))
        if (any(c.islower() for c in pwd) and 
            any(c.isupper() for c in pwd) and 
            any(c.isdigit() for c in pwd) and 
            any(c in "!@#$%^&*" for c in pwd)):
            return pwd

class SendCredentialsMixin:
    def send_credentials_button(self, obj):
        url = reverse(f'admin:{obj._meta.app_label}_{obj._meta.model_name}_send_email', args=[obj.pk])
        return format_html(
            '<a class="button" style="background-color: #4CAF50; color: white; padding: 5px 10px; text-decoration: none; border-radius: 4px;" href="{}">Send Email</a>',
            url
        )
    send_credentials_button.short_description = 'Send Credentials'
    send_credentials_button.allow_tags = True

    def get_urls(self):
        urls = super().get_urls()
        custom_urls = [
            path('<path:pk>/send-email/', self.admin_site.admin_view(self.process_send_email), name=f'{self.model._meta.app_label}_{self.model._meta.model_name}_send_email'),
        ]
        return custom_urls + urls

    def process_send_email(self, request, pk, *args, **kwargs):
        obj = self.get_object(request, pk)
        if obj:
            temp_pwd = generate_temp_password()
            obj.password = make_password(temp_pwd)
            obj.must_change_password = True
            obj.save(update_fields=['password', 'must_change_password'])
            
            role = obj.__class__.__name__
            subject = f'Welcome to JanMat - {role} Credentials'
            creator = obj.created_by if hasattr(obj, 'created_by') else None
            creator_email = creator.email if creator else 'N/A'
            creator_phone = creator.phone_number if creator and getattr(creator, 'phone_number', None) else 'N/A'

            message = f'''Hello {obj.name or role},

Your {role} account is ready on the JanMat portal.

Your login details:
Username: {obj.username or obj.email}
Temporary Password: {temp_pwd}

Please log in to the portal where you will be prompted to change your password immediately.

For any issues or queries, please contact your Administrator:
Email: {creator_email}
Phone: {creator_phone}

Regards,
JanMat System'''
            send_mail_async(subject, message, [obj.email])
            self.message_user(request, f"Successfully sent credentials to {obj.email}.", messages.SUCCESS)
        return redirect(reverse(f"admin:{self.model._meta.app_label}_{self.model._meta.model_name}_changelist"))

@admin.action(description="Send Credentials Email")
def send_credentials_email_action(modeladmin, request, queryset):
    sent_count = 0
    for obj in queryset:
        temp_pwd = generate_temp_password()
        obj.password = make_password(temp_pwd)
        obj.must_change_password = True
        obj.save(update_fields=['password', 'must_change_password'])
        
        role = obj.__class__.__name__
        subject = f'Welcome to JanMat - {role} Credentials'
        creator = obj.created_by if hasattr(obj, 'created_by') else None
        creator_email = creator.email if creator else 'N/A'
        creator_phone = creator.phone_number if creator and getattr(creator, 'phone_number', None) else 'N/A'

        message = f'''Hello {obj.name or role},

Your {role} account is ready on the JanMat portal.

Your login details:
Username: {obj.username or obj.email}
Temporary Password: {temp_pwd}

Please log in to the portal where you will be prompted to change your password immediately.

For any issues or queries, please contact your Administrator:
Email: {creator_email}
Phone: {creator_phone}

Regards,
JanMat System'''
        send_mail_async(subject, message, [obj.email])
        sent_count += 1
    
    modeladmin.message_user(request, f"Successfully sent credentials to {sent_count} user(s).", messages.SUCCESS)

@admin.register(SuperAdmin)
class SuperAdminAdmin(SendCredentialsMixin, admin.ModelAdmin):
    list_display = ('email', 'name', 'phone_number', 'is_active', 'created_at', 'send_credentials_button')
    search_fields = ('email', 'name', 'phone_number')
    actions = [send_credentials_email_action]
    
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

@admin.register(Admin)
class AdminAdmin(SendCredentialsMixin, admin.ModelAdmin):
    list_display = ('username', 'email', 'name', 'phone_number', 'state', 'district', 'tehsil', 'created_by', 'is_active', 'send_credentials_button')
    search_fields = ('email', 'name', 'phone_number', 'state', 'district')
    list_filter = ('created_by', 'state', 'district')
    actions = [send_credentials_email_action]
    
    exclude = ('password', 'created_by', 'username')

    class Media:
        js = ('accounts/js/admin_geo.js',)
    
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
            
        # Auto-generate username based on hierarchy if missing or new
        if not obj.username or is_new:
            # Format: admin-[first_name].[state_shortform][district_shortform][tehsil_shortform].janmat.gov.in
            name_part = "".join(filter(str.isalnum, (obj.name or "admin").split()[0].lower()))
            state_part = get_shortform(obj.state or "st")
            dist_part = get_shortform(obj.district or "dt")
            tehsil_part = get_shortform(obj.tehsil or "th")
            
            geo_string = f"{state_part.upper()}{dist_part}{tehsil_part.upper()}"
            base_username = f"admin-{name_part}.{geo_string}.janmat.gov.in"
            
            # Ensure unique
            counter = 1
            final_username = base_username
            while type(obj).objects.filter(username=final_username).exclude(pk=obj.pk).exists():
                final_username = f"admin-{name_part}{counter}.{geo_string}.janmat.gov.in"
                counter += 1
            obj.username = final_username
            
        super().save_model(request, obj, form, change)

@admin.register(Operator)
class OperatorAdmin(SendCredentialsMixin, admin.ModelAdmin):
    list_display = ('username', 'email', 'name', 'phone_number', 'booth_id', 'created_by', 'is_active', 'send_credentials_button')
    search_fields = ('email', 'name', 'phone_number', 'booth_id')
    list_filter = ('created_by', 'booth_id')
    actions = [send_credentials_email_action]
    
    exclude = ('password', 'username')
    
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
            
        # Auto-generate operator username based on linked Admin's geography
        if not obj.username or is_new:
            name_part = "".join(filter(str.isalnum, (obj.name or "operator").split()[0].lower()))
            
            # Extract geographic data from parent Admin
            admin_parent = obj.created_by
            state_part = get_shortform(admin_parent.state if admin_parent and admin_parent.state else "st")
            dist_part = get_shortform(admin_parent.district if admin_parent and admin_parent.district else "dt")
            tehsil_part = get_shortform(admin_parent.tehsil if admin_parent and admin_parent.tehsil else "th")
            
            geo_string = f"{state_part.upper()}{dist_part}{tehsil_part.upper()}"
            base_username = f"operator-{name_part}.{geo_string}.janmat.gov.in"
            
            # Ensure unique
            counter = 1
            final_username = base_username
            while type(obj).objects.filter(username=final_username).exclude(pk=obj.pk).exists():
                final_username = f"operator-{name_part}{counter}.{geo_string}.janmat.gov.in"
                counter += 1
            obj.username = final_username
            
        super().save_model(request, obj, form, change)