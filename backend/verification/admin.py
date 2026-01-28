from django.contrib import admin
from .models import Voter, OTPCode, BiometricTemplate

@admin.register(Voter)
class VoterAdmin(admin.ModelAdmin):
    """Voter admin with tenant isolation"""
    list_display = ('full_name', 'aadhaar_masked', 'gender', 'has_voted', 'verified_at', 'admin_id')
    list_filter = ('admin_id', 'gender', 'has_voted', 'verified_at')
    search_fields = ('full_name', 'aadhaar_number')
    readonly_fields = ('aadhaar_masked', 'created_at', 'verified_at')
    
    def aadhaar_masked(self, obj):
        return f"XXXX-XXXX-{obj.aadhaar_number[-4:]}"
    aadhaar_masked.short_description = 'Aadhaar (Masked)'

@admin.register(BiometricTemplate)
class BiometricTemplateAdmin(admin.ModelAdmin):
    """Biometric template admin with tenant isolation"""
    list_display = ('voter_id', 'scan_quality', 'created_at', 'operator_id', 'admin_id')
    list_filter = ('admin_id', 'scan_quality', 'created_at')
    search_fields = ('voter_id',)
    readonly_fields = ('template_hash', 'created_at')

@admin.register(OTPCode)
class OTPCodeAdmin(admin.ModelAdmin):
    """OTP code admin with tenant isolation"""
    list_display = ('aadhaar_masked', 'otp_code', 'expires_at', 'is_used', 'attempts', 'admin_id')
    list_filter = ('admin_id', 'is_used', 'expires_at')
    search_fields = ('aadhaar_number',)
    readonly_fields = ('created_at',)
    
    def aadhaar_masked(self, obj):
        return f"XXXX-XXXX-{obj.aadhaar_number[-4:]}"
    aadhaar_masked.short_description = 'Aadhaar (Masked)'