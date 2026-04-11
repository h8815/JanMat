import os
from django import forms
from django.contrib import admin
from django.contrib import messages
from django.contrib.auth.hashers import make_password
from django.conf import settings
from .models import SuperAdmin, Admin, Operator
from .utils import send_mail_async, get_welcome_email_template, generate_temp_password, get_shortform
from django.urls import path, reverse
from django.utils.html import format_html
from django.shortcuts import redirect, render
from django.http import HttpResponseRedirect
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

class UpdateValidityActionForm(forms.Form):
    valid_from = forms.DateTimeField(widget=forms.DateTimeInput(attrs={'type': 'datetime-local'}), required=True)
    valid_until = forms.DateTimeField(widget=forms.DateTimeInput(attrs={'type': 'datetime-local'}), required=True)
    cascade_validity = forms.BooleanField(
        required=False,
        label="Update Operator Validity Windows? (Applies to Admins only)",
        help_text="Check this box if you want ALL operators managed by the selected Admins to inherit this exact time window."
    )

@admin.action(description="Update Credential Validity Window")
def update_validity_window_action(modeladmin, request, queryset):
    if 'apply' in request.POST:
        form = UpdateValidityActionForm(request.POST)
        if form.is_valid():
            valid_from = form.cleaned_data['valid_from']
            valid_until = form.cleaned_data['valid_until']
            cascade = form.cleaned_data.get('cascade_validity', False)
            
            count = 0
            for obj in queryset:
                obj.valid_from = valid_from
                obj.valid_until = valid_until
                obj.save(update_fields=['valid_from', 'valid_until'])
                count += 1
                
                if cascade and hasattr(obj, 'operators'):
                    obj.operators.update(valid_from=valid_from, valid_until=valid_until)

            modeladmin.message_user(request, f"Updated validity window for {count} record(s).", messages.SUCCESS)
            return HttpResponseRedirect(request.get_full_path())
    else:
        form = UpdateValidityActionForm()

    return render(request, 'admin/update_validity_action.html', {
        'items': queryset,
        'form': form,
        'action_name': request.POST.get('action'),
        'title': 'Bulk Update Credential Validity',
        **modeladmin.admin_site.each_context(request),
    })

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

class AdminAdminForm(forms.ModelForm):
    cascade_validity = forms.BooleanField(
        label="Update Operator Validity Windows? / क्या इस एडमिन के सभी ऑपरेटरों की वैधता समय-सीमा (विंडो) भी अपडेट करनी है?",
        required=False,
        initial=False,
        help_text="Check this box if you want ALL operators managed by this Admin to suddenly inherit strings representing valid_from and valid_until exactly matching the values chosen above."
    )

    class Meta:
        model = Admin
        fields = '__all__'

@admin.register(Admin)
class AdminAdmin(SendCredentialsMixin, admin.ModelAdmin):
    form = AdminAdminForm
    list_display = ('username', 'email', 'name', 'phone_number', 'state', 'district', 'tehsil',
                    'created_by', 'is_active', 'get_validity_badge', 'send_credentials_button')
    search_fields = ('email', 'name', 'phone_number', 'state', 'district')
    list_filter = ('created_by', 'state', 'district')
    actions = [send_credentials_email_action, update_validity_window_action]
    
    exclude = ('password', 'created_by', 'username')

    fieldsets = [
        ('Identity', {'fields': ('name', 'email', 'phone_number', 'is_active')}),
        ('Geographic Jurisdiction', {'fields': ('state', 'district', 'tehsil')}),
        ('Credential Validity Window प्रमाण-पत्र दिनांक', {
            'description': 'Both fields are required. Admin cannot login outside this window.',
            'fields': ('valid_from', 'valid_until', 'cascade_validity')
        }),
    ]

    class Media:
        js = ('accounts/js/admin_geo.js',)

    def get_validity_badge(self, obj):
        from django.utils import timezone as tz
        now = tz.now()
        if not obj.valid_from and not obj.valid_until:
            return format_html('<span style="color:#6b7280;font-weight:600;">&#9679; OPEN</span>')
        if obj.valid_until and now > obj.valid_until:
            return format_html('<span style="color:#DC2626;font-weight:600;">&#9679; EXPIRED</span>')
        if obj.valid_from and now < obj.valid_from:
            return format_html('<span style="color:#f59e0b;font-weight:600;">&#9679; PENDING</span>')
        return format_html('<span style="color:#16a34a;font-weight:600;">&#9679; ACTIVE</span>')
    get_validity_badge.short_description = 'Window Status'
    
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
        
        if change and form.cleaned_data.get('cascade_validity'):
            obj.operators.update(valid_from=obj.valid_from, valid_until=obj.valid_until)

# ============================================================================
# OPERATOR
# ============================================================================

@admin.register(Operator)
class OperatorAdmin(SendCredentialsMixin, admin.ModelAdmin):
    list_display = ('get_username_display', 'name', 'phone_number', 'booth_id',
                    'get_admin_display', 'get_status_badge', 'get_validity_badge', 'send_credentials_button')
    search_fields = ('email', 'name', 'phone_number', 'booth_id')
    list_filter = ('is_active', 'created_by')
    actions = [send_credentials_email_action, update_validity_window_action]
    
    exclude = ('password', 'username')

    fieldsets = [
        ('Identity', {'fields': ('name', 'email', 'phone_number', 'is_active', 'created_by')}),
        ('Booth Assignment', {'fields': ('booth_id',)}),
        ('Credential Validity Window प्रमाण-पत्र दिनांक', {
            'description': 'Both fields are required. Operator cannot login outside this window.',
            'fields': ('valid_from', 'valid_until')
        }),
    ]

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

    def get_validity_badge(self, obj):
        from django.utils import timezone as tz
        now = tz.now()
        if not obj.valid_from and not obj.valid_until:
            return format_html('<span style="color:#6b7280;font-weight:600;">&#9679; OPEN</span>')
        if obj.valid_until and now > obj.valid_until:
            return format_html('<span style="color:#DC2626;font-weight:600;">&#9679; EXPIRED</span>')
        if obj.valid_from and now < obj.valid_from:
            return format_html('<span style="color:#f59e0b;font-weight:600;">&#9679; PENDING</span>')
        return format_html('<span style="color:#16a34a;font-weight:600;">&#9679; ACTIVE</span>')
    get_validity_badge.short_description = 'Window'

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


# ============================================================================
# SUPERADMIN FORCED PASSWORD CHANGE — Custom Admin View
# ============================================================================
from django.http import HttpResponseRedirect
from django.views.decorators.csrf import csrf_protect
from django.utils.decorators import method_decorator
from django.contrib.auth.hashers import check_password as _check_pwd
from django.template.response import TemplateResponse


def _superadmin_change_password_view(request):
    """
    Custom Django admin view at /janmat-superadmin/change-password/.
    Handles the forced first-login password change for SuperAdmin accounts.
    """
    # Only accessible when logged in via the Django admin session
    if not request.user.is_authenticated:
        return HttpResponseRedirect(f'/janmat-superadmin/login/?next={request.path}')

    # Resolve the actual SuperAdmin profile
    sa = getattr(request.user, 'super_admin_profile', None)
    if sa is None:
        # Not a SuperAdmin session — just redirect to admin index
        return HttpResponseRedirect('/janmat-superadmin/')

    error = None

    if request.method == 'POST':
        old_pwd = request.POST.get('old_password', '')
        new_pwd = request.POST.get('new_password', '')
        confirm_pwd = request.POST.get('confirm_password', '')

        if not _check_pwd(old_pwd, sa.password):
            error = 'Current / temporary password is incorrect.'
        elif len(new_pwd) < 12:
            error = 'New password must be at least 12 characters long.'
        elif new_pwd != confirm_pwd:
            error = 'Passwords do not match.'
        else:
            sa.password = make_password(new_pwd)
            sa.must_change_password = False
            sa.save(update_fields=['password', 'must_change_password'])
            messages.success(request, 'Password changed successfully. Welcome to the JanMat Administration Portal.')
            return HttpResponseRedirect('/janmat-superadmin/')

    context = {
        'title': 'Change Password',
        'error': error,
        'has_permission': True,
    }
    return TemplateResponse(request, 'admin/change_password.html', context)


# Extend admin.site URLs to include the change-password URL
_original_get_urls = admin.site.__class__.get_urls

def _patched_get_urls(self):
    custom_urls = [
        path('change-password/', admin.site.admin_view(_superadmin_change_password_view), name='superadmin_change_password'),
    ]
    return custom_urls + _original_get_urls(self)

admin.site.__class__.get_urls = _patched_get_urls