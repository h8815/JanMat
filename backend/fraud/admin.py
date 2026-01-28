from django.contrib import admin
from .models import FraudLog, AuditLog

@admin.register(FraudLog)
class FraudLogAdmin(admin.ModelAdmin):
    """Fraud log admin with tenant isolation"""
    list_display = ('fraud_type', 'aadhaar_masked', 'booth_number', 'flagged_at', 'reviewed', 'admin')
    list_filter = ('admin', 'fraud_type', 'reviewed', 'flagged_at')
    search_fields = ('aadhaar_number', 'booth_number')
    readonly_fields = ('flagged_at', 'details')
    
    def aadhaar_masked(self, obj):
        if obj.aadhaar_number:
            return f"XXXX-XXXX-{obj.aadhaar_number[-4:]}"
        return "N/A"
    aadhaar_masked.short_description = 'Aadhaar (Masked)'
    
    def get_queryset(self, request):
        """Filter fraud logs based on admin permissions"""
        qs = super().get_queryset(request)
        if request.user.is_superuser:
            return qs
        return qs.filter(admin=request.user)

@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    """Audit log admin with tenant isolation"""
    list_display = ('action', 'user_type', 'user_id', 'created_at', 'admin')
    list_filter = ('admin', 'action', 'user_type', 'created_at')
    search_fields = ('user_id', 'action')
    readonly_fields = ('created_at', 'details', 'ip_address', 'user_agent')
    
    def get_queryset(self, request):
        """Filter audit logs based on admin permissions"""
        qs = super().get_queryset(request)
        if request.user.is_superuser:
            return qs
        return qs.filter(admin=request.user)