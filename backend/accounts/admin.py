import os
from django.contrib import admin
from django.contrib import messages
from django.contrib.auth.hashers import make_password
from django.conf import settings
from .models import SuperAdmin, Admin, Operator
from .utils import send_mail_async, get_welcome_email_template, generate_temp_password, get_shortform
from django.urls import path, reverse
from django.utils.html import format_html
from django.shortcuts import redirect
import logging

logger = logging.getLogger(__name__)

# ============================================================================
# ACTIONS & MIXINS
# ============================================================================

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

        message, html_message = get_welcome_email_template(
            obj.name or role, 
            role, 
            obj.username or obj.email, 
            temp_pwd,
            creator_email,
            creator_phone
        )
        
        attachments = {
            'logo': os.path.join(settings.BASE_DIR, 'static', 'assets', 'images', 'mail.png')
        }
        send_mail_async(subject, message, [obj.email], html_message=html_message, attachments=attachments)
        sent_count += 1
    
    modeladmin.message_user(request, f"Successfully sent credentials to {sent_count} user(s).", messages.SUCCESS)

class SendCredentialsMixin:
    """Mixin to add 'Send Credentials' functionality to admin classes"""
    
    def send_credentials_button(self, obj):
        url = reverse(f'admin:{obj._meta.app_label}_{obj._meta.model_name}_send_email', args=[obj.pk])
        return format_html(
            '<a class="button" href="{}">Send Email</a>',
            url
        )
    send_credentials_button.short_description = 'Send Credentials'

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

            message, html_message = get_welcome_email_template(
                obj.name or role, 
                role, 
                obj.username or obj.email, 
                temp_pwd,
                creator_email,
                creator_phone
            )
            
            attachments = {
                'logo': os.path.join(settings.BASE_DIR, 'static', 'assets', 'images', 'mail.png')
            }
            send_mail_async(subject, message, [obj.email], html_message=html_message, attachments=attachments)
            self.message_user(request, f"Successfully sent credentials to {obj.email}.", messages.SUCCESS)
        return redirect(reverse(f"admin:{self.model._meta.app_label}_{self.model._meta.model_name}_changelist"))

# ============================================================================
# SUPER ADMIN
# ============================================================================

@admin.register(SuperAdmin)
class SuperAdminAdmin(SendCredentialsMixin, admin.ModelAdmin):
    list_display = ('email', 'name', 'phone_number', 'is_active', 'created_at', 'send_credentials_button')
    search_fields = ('email', 'name', 'phone_number')
    actions = [send_credentials_email_action]
    
    def get_queryset(self, request):
        qs = super().get_queryset(request)
        if hasattr(request.user, 'super_admin_profile'):
            return qs.filter(id=request.user.super_admin_profile.id)
        return qs

    exclude = ('password',)

    def has_delete_permission(self, request, obj=None):
        return False

    def save_model(self, request, obj, form, change):
        if not change:
            temp_pwd = generate_temp_password()
            obj.password = make_password(temp_pwd)
            obj.must_change_password = True
        super().save_model(request, obj, form, change)

# ============================================================================
# ADMIN
# ============================================================================

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
        if hasattr(request.user, 'super_admin_profile'):
            return qs.filter(created_by=request.user.super_admin_profile)
        return qs

    def save_model(self, request, obj, form, change):
        is_new = not change
        if is_new and hasattr(request.user, 'super_admin_profile'):
            obj.created_by = request.user.super_admin_profile
            
        if is_new:
            temp_pwd = generate_temp_password()
            obj.password = make_password(temp_pwd)
            obj.must_change_password = True
            
        if not obj.username or is_new:
            name_part = "".join(filter(str.isalnum, (obj.name or "admin").split()[0].lower()))
            state_part = get_shortform(obj.state or "st")
            dist_part = get_shortform(obj.district or "dt")
            tehsil_part = get_shortform(obj.tehsil or "th")
            
            geo_string = f"{state_part.upper()}{dist_part}{tehsil_part.upper()}"
            base_username = f"admin-{name_part}.{geo_string}.janmat.gov.in"
            
            counter = 1
            final_username = base_username
            while Admin.objects.filter(username=final_username).exclude(pk=obj.pk).exists():
                final_username = f"admin-{name_part}{counter}.{geo_string}.janmat.gov.in"
                counter += 1
            obj.username = final_username
            
        super().save_model(request, obj, form, change)

# ============================================================================
# OPERATOR
# ============================================================================

@admin.register(Operator)
class OperatorAdmin(SendCredentialsMixin, admin.ModelAdmin):
    list_display = ('get_username_display', 'name', 'phone_number', 'booth_id', 'get_admin_display', 'get_status_badge', 'send_credentials_button')
    search_fields = ('email', 'name', 'phone_number', 'booth_id')
    list_filter = ('is_active', 'created_by')
    actions = [send_credentials_email_action]
    
    exclude = ('password', 'username')
    
    def get_username_display(self, obj):
        return format_html('<strong style="color: #00234B;">{}</strong>', obj.username or obj.email)
    get_username_display.short_description = 'Username / Email'

    def get_admin_display(self, obj):
        if obj.created_by:
            return obj.created_by.name or obj.created_by.email
        return '—'
    get_admin_display.short_description = 'Parent Admin'

    def get_status_badge(self, obj):
        if obj.is_active:
            return format_html('<span class="status-badge status-badge-active">● ACTIVE</span>')
        return format_html('<span class="status-badge status-badge-inactive">● INACTIVE</span>')
    get_status_badge.short_description = 'Status'

    def get_queryset(self, request):
        qs = super().get_queryset(request)
        if hasattr(request.user, 'super_admin_profile'):
            return qs.filter(created_by__created_by=request.user.super_admin_profile)
        if hasattr(request.user, 'admin_profile'):
            return qs.filter(created_by=request.user.admin_profile)
        return qs
    
    def formfield_for_foreignkey(self, db_field, request, **kwargs):
        if db_field.name == "created_by":
             if hasattr(request.user, 'super_admin_profile'):
                 kwargs["queryset"] = Admin.objects.filter(created_by=request.user.super_admin_profile)
        return super().formfield_for_foreignkey(db_field, request, **kwargs)

    def save_model(self, request, obj, form, change):
        is_new = not change
        if is_new:
            temp_pwd = generate_temp_password()
            obj.password = make_password(temp_pwd)
            obj.must_change_password = True
            
        if not obj.username or is_new:
            name_part = "".join(filter(str.isalnum, (obj.name or "operator").split()[0].lower()))
            admin_parent = obj.created_by
            state_part = get_shortform(admin_parent.state if admin_parent else "st")
            dist_part = get_shortform(admin_parent.district if admin_parent else "dt")
            tehsil_part = get_shortform(admin_parent.tehsil if admin_parent else "th")
            
            geo_string = f"{state_part.upper()}{dist_part}{tehsil_part.upper()}"
            base_username = f"operator-{name_part}.{geo_string}.janmat.gov.in"
            
            counter = 1
            final_username = base_username
            while Operator.objects.filter(username=final_username).exclude(pk=obj.pk).exists():
                final_username = f"operator-{name_part}{counter}.{geo_string}.janmat.gov.in"
                counter += 1
            obj.username = final_username
            
        super().save_model(request, obj, form, change)

# ============================================================================
# UNREGISTER & CLEANUP
# ============================================================================

from django.contrib.auth.models import Group
try:
    admin.site.unregister(Group)
except admin.sites.NotRegistered:
    pass