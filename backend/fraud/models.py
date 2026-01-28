import uuid
from django.db import models
from accounts.models import Admin, Operator, SuperAdmin

class FraudLog(models.Model):
    """Fraud log model with tenant isolation"""
    FRAUD_TYPES = [
        ('duplicate_biometric', 'Duplicate Biometric'),
        ('multiple_otp_attempts', 'Multiple OTP Attempts'),
        ('already_voted', 'Already Voted'),
        ('invalid_session', 'Invalid Session'),
        ('suspicious_activity', 'Suspicious Activity'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    fraud_type = models.CharField(max_length=50, choices=FRAUD_TYPES)
    aadhaar_number = models.CharField(max_length=12, blank=True)
    biometric_hash = models.CharField(max_length=255, blank=True)
    
    # Linked to Operator who encountered it
    operator = models.ForeignKey(Operator, on_delete=models.SET_NULL, null=True, blank=True)
    
    booth_number = models.CharField(max_length=20, blank=True)
    details = models.JSONField(default=dict)
    flagged_at = models.DateTimeField(auto_now_add=True)
    reviewed = models.BooleanField(default=False)
    admin_notes = models.TextField(blank=True)
    
    # Linked to Admin (Tenant) who owns this fraud log
    admin = models.ForeignKey(Admin, on_delete=models.CASCADE, related_name='fraud_logs')

    class Meta:
        db_table = 'fraud_logs'
        indexes = [
            models.Index(fields=['admin', 'fraud_type', 'flagged_at']),
            models.Index(fields=['admin', 'reviewed']),
            models.Index(fields=['admin', 'booth_number']),
        ]

    def __str__(self):
        return f"{self.fraud_type} - {self.flagged_at.strftime('%Y-%m-%d %H:%M')}"

class AuditLog(models.Model):
    """Audit log model with tenant isolation"""
    ACTION_TYPES = [
        ('login', 'Login'),
        ('logout', 'Logout'),
        ('otp_sent', 'OTP Sent'),
        ('otp_verified', 'OTP Verified'),
        ('biometric_scan', 'Biometric Scan'),
        ('fraud_flagged', 'Fraud Flagged'),
        ('admin_action', 'Admin Action'),
        ('operator_created', 'Operator Created'),
    ]
    
    USER_TYPES = [
        ('superadmin', 'Super Admin'),
        ('admin', 'Admin'),
        ('operator', 'Operator'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    action = models.CharField(max_length=100, choices=ACTION_TYPES)
    
    # Who performed the action
    user_type = models.CharField(max_length=20, choices=USER_TYPES)
    user_id = models.UUIDField() # Store ID of SuperAdmin/Admin/Operator
    
    resource_type = models.CharField(max_length=50, blank=True)
    resource_id = models.UUIDField(null=True, blank=True)
    details = models.JSONField(default=dict)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    # Tenant Owner (Admin) - Nullable because SuperAdmins might not belong to a Tenant
    admin = models.ForeignKey(Admin, on_delete=models.SET_NULL, null=True, blank=True, related_name='audit_logs')

    class Meta:
        db_table = 'audit_logs'
        indexes = [
            models.Index(fields=['admin', 'user_type', 'user_id', 'action']),
            models.Index(fields=['admin', 'created_at']),
        ]

    def __str__(self):
        return f"{self.action} by {self.user_type} - {self.created_at.strftime('%Y-%m-%d %H:%M')}"