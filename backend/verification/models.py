import uuid
from django.db import models
from django.utils import timezone
from datetime import timedelta

class Voter(models.Model):
    """Voter model with tenant isolation via admin_id"""
    GENDER_CHOICES = [
        ('Male', 'Male'),
        ('Female', 'Female'),
        ('Other', 'Other'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    aadhaar_number = models.CharField(max_length=12, db_index=True)
    full_name = models.CharField(max_length=255)
    full_name_hindi = models.CharField(max_length=255, blank=True)
    date_of_birth = models.DateField()
    gender = models.CharField(max_length=10, choices=GENDER_CHOICES)
    mobile_number = models.CharField(max_length=15, blank=True)
    full_address = models.TextField(blank=True)
    photo_base64 = models.TextField(blank=True)
    photo_url = models.URLField(max_length=500, blank=True)
    verified_at = models.DateTimeField(null=True, blank=True)
    has_voted = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    
    # TENANT ISOLATION: UUID field for admin
    admin_id = models.UUIDField(db_index=True)
    operator_id = models.UUIDField(null=True, blank=True)

    class Meta:
        db_table = 'voters'
        indexes = [
            models.Index(fields=['admin_id', 'aadhaar_number']),
            models.Index(fields=['admin_id', 'has_voted']),
        ]
        unique_together = [['admin_id', 'aadhaar_number']]

    def __str__(self):
        return f"{self.full_name} ({self.aadhaar_number})"

class OTPCode(models.Model):
    """OTP model with tenant isolation via admin_id"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    aadhaar_number = models.CharField(max_length=12, db_index=True)
    otp_code = models.CharField(max_length=6, blank=True)
    reference_id = models.CharField(max_length=255, blank=True)
    expires_at = models.DateTimeField()
    attempts = models.IntegerField(default=0)
    is_used = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    
    # TENANT ISOLATION: UUID field for admin
    admin_id = models.UUIDField(db_index=True)

    class Meta:
        db_table = 'otp_codes'
        indexes = [
            models.Index(fields=['admin_id', 'aadhaar_number', 'expires_at']),
            models.Index(fields=['admin_id', 'reference_id']),
            models.Index(fields=['admin_id', 'is_used']),
        ]
    
    @property
    def is_expired(self):
        return timezone.now() > self.expires_at

    @property
    def is_valid(self):
        return not self.is_used and not self.is_expired

    def __str__(self):
        return f"OTP for {self.aadhaar_number} - ref: {self.reference_id}"

class BiometricTemplate(models.Model):
    """Biometric template model with tenant isolation via admin_id"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    voter_id = models.UUIDField()
    template_hash = models.CharField(max_length=255, db_index=True)
    scan_quality = models.IntegerField()
    created_at = models.DateTimeField(auto_now_add=True)
    
    # TENANT ISOLATION: UUID field for admin
    admin_id = models.UUIDField(db_index=True)
    operator_id = models.UUIDField(null=True, blank=True)

    class Meta:
        db_table = 'biometric_templates'
        indexes = [
            models.Index(fields=['admin_id', 'template_hash']),
        ]
        unique_together = [['admin_id', 'template_hash']]

    def __str__(self):
        return f"Biometric template {self.template_hash[:8]}..."