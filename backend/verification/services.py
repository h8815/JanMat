"""
JanMat Verification Services
Implements core business logic with tenant isolation
"""
import hashlib
import hmac
import random
import requests
import logging
from datetime import timedelta
from django.utils import timezone
from django.conf import settings
from django.db import transaction
from django.core.cache import cache

from .models import Voter, OTPCode, BiometricTemplate
from fraud.models import FraudLog, AuditLog

logger = logging.getLogger(__name__)

class AadhaarService:
    """Service for Aadhaar verification using Sandbox.co.in API v2.0"""
    
    # API Endpoints
    SEND_OTP_URL = "https://api.sandbox.co.in/kyc/aadhaar/okyc/otp"
    VERIFY_OTP_URL = "https://api.sandbox.co.in/kyc/aadhaar/okyc/otp/verify"
    
    @staticmethod
    def send_otp(aadhaar_number, admin_id):
        """Send OTP to Aadhaar registered mobile - CORRECTED API CALL"""
        try:
            # Rate limiting per admin
            rate_key = f"otp_rate_{admin_id}_{aadhaar_number}"
            if cache.get(rate_key, 0) >= settings.MAX_OTP_ATTEMPTS:
                raise Exception("Rate limit exceeded for this Aadhaar")
            
            # CORRECT: Call Sandbox API with proper payload format
            headers = {
                "accept": "application/json",
                "authorization": settings.SANDBOX_AUTHORIZATION,
                "x-api-key": settings.SANDBOX_API_KEY,
                "x-api-version": "2.0",
                "content-type": "application/json"
            }
            
            payload = {
                "@entity": "in.co.sandbox.kyc.aadhaar.okyc.otp.request",
                "aadhaar_number": aadhaar_number,
                "consent": "y",  # lowercase 'y' as per API spec
                "reason": "For KYC verification"
            }
            
            response = requests.post(
                AadhaarService.SEND_OTP_URL,
                json=payload,
                headers=headers,
                timeout=10
            )
            
            response_data = response.json()
            
            if response.status_code == 200 and response_data.get('data'):
                # Extract reference_id from response
                reference_id = response_data['data'].get('reference_id')
                
                if not reference_id:
                    raise Exception("No reference_id in API response")
                
                # CRITICAL: Store reference_id in OTP record
                expires_at = timezone.now() + timedelta(minutes=settings.OTP_EXPIRY_MINUTES)
                
                with transaction.atomic():
                    # Invalidate previous OTPs for this Aadhaar under this admin
                    OTPCode.objects.filter(
                        admin_id=admin_id,
                        aadhaar_number=aadhaar_number,
                        is_used=False
                    ).update(is_used=True)
                    
                    # Create new OTP record with reference_id
                    otp_record = OTPCode.objects.create(
                        admin_id=admin_id,
                        aadhaar_number=aadhaar_number,
                        otp_code="",  # We don't know the OTP, Sandbox sends it via SMS
                        reference_id=reference_id,  # CRITICAL: Store this
                        expires_at=expires_at
                    )
                
                # Update rate limiting
                cache.set(rate_key, cache.get(rate_key, 0) + 1, timeout=3600)
                
                logger.info(f"OTP sent for Aadhaar {aadhaar_number}, reference_id: {reference_id}")
                
                return {
                    'success': True,
                    'message': 'OTP sent successfully to registered mobile number',
                    'reference_id': reference_id,
                    'expires_at': expires_at.isoformat()
                }
            else:
                error_msg = response_data.get('message', 'Failed to send OTP')
                raise Exception(error_msg)
                
        except Exception as e:
            logger.error(f"Send OTP failed for {aadhaar_number}: {str(e)}")
            raise e
    
    @staticmethod
    def verify_otp(aadhaar_number, otp_code, admin_id):
        """Verify OTP and retrieve Aadhaar details - CORRECTED API CALL"""
        try:
            # Find latest OTP record with reference_id
            otp_record = OTPCode.objects.filter(
                admin_id=admin_id,
                aadhaar_number=aadhaar_number,
                is_used=False
            ).order_by('-created_at').first()
            
            if not otp_record:
                return {'success': False, 'error': 'No OTP request found. Please request OTP first.'}
            
            if otp_record.is_expired:
                return {'success': False, 'error': 'OTP expired. Please request a new OTP.'}
            
            if not otp_record.reference_id:
                return {'success': False, 'error': 'Invalid OTP session. Please request OTP again.'}
            
            # Increment attempts
            otp_record.attempts += 1
            otp_record.save()
            
            if otp_record.attempts > settings.MAX_OTP_ATTEMPTS:
                otp_record.is_used = True
                otp_record.save()
                return {'success': False, 'error': 'Maximum attempts exceeded'}
            
            # CORRECT: Verify with Sandbox API
            headers = {
                "accept": "application/json",
                "authorization": settings.SANDBOX_AUTHORIZATION,
                "x-api-key": settings.SANDBOX_API_KEY,
                "x-api-version": "2.0",
                "content-type": "application/json"
            }
            
            payload = {
                "@entity": "in.co.sandbox.kyc.aadhaar.okyc.request",
                "reference_id": otp_record.reference_id,
                "otp": otp_code
            }
            
            response = requests.post(
                AadhaarService.VERIFY_OTP_URL,
                json=payload,
                headers=headers,
                timeout=10
            )
            
            response_data = response.json()
            
            if response.status_code == 200 and response_data.get('data', {}).get('status') == 'VALID':
                # Mark OTP as used
                otp_record.is_used = True
                otp_record.save()
                
                # Extract Aadhaar data
                data = response_data['data']
                
                # Get or create voter record
                voter, created = Voter.objects.get_or_create(
                    admin_id=admin_id,
                    aadhaar_number=aadhaar_number,
                    defaults={
                        'full_name': data.get('name', ''),
                        'full_name_hindi': data.get('name_hindi', ''),
                        'date_of_birth': data.get('date_of_birth', timezone.now().date()),
                        'gender': data.get('gender', 'Other'),
                        'mobile_number': data.get('mobile_number', ''),
                        'full_address': data.get('full_address', ''),
                        'photo_base64': data.get('photo', ''),  # Store base64 photo
                    }
                )
                
                logger.info(f"OTP verified for Aadhaar {aadhaar_number}")
                
                return {
                    'success': True,
                    'voter': {
                        'id': str(voter.id),
                        'full_name': voter.full_name,
                        'full_name_hindi': voter.full_name_hindi,
                        'aadhaar_masked': f"XXXX-XXXX-{aadhaar_number[-4:]}",
                        'gender': voter.gender,
                        'date_of_birth': str(voter.date_of_birth),
                        'full_address': voter.full_address,
                        'photo_base64': voter.photo_base64,  # Send photo to frontend
                        'has_voted': voter.has_voted,
                    }
                }
            else:
                error_msg = response_data.get('message', 'Invalid OTP')
                return {'success': False, 'error': error_msg}
                
        except Exception as e:
            logger.error(f"OTP verification failed: {str(e)}")
            return {'success': False, 'error': 'Verification service error'}
    


class BiometricService:
    """Service for biometric processing with tenant isolation"""
    
    @staticmethod
    def generate_template_hash(biometric_data, quality_score):
        """
        Generate secure hash from biometric template
        NOTE: This is a DEMO implementation. Real deployment requires biometric SDK.
        """
        # DEMO: Simulate biometric template processing
        # Real implementation would use SourceAFIS, NBIS, or vendor SDK
        
        # Create deterministic hash from biometric data
        salt = settings.BIOMETRIC_SALT.encode('utf-8')
        
        # Simulate template extraction (in real system, this would be SDK output)
        template_data = f"{biometric_data}_{quality_score}".encode('utf-8')
        
        # Generate secure hash
        template_hash = hmac.new(
            salt,
            template_data,
            hashlib.sha256
        ).hexdigest()
        
        logger.info(f"Generated biometric template hash (quality: {quality_score})")
        return template_hash
    
    @staticmethod
    def check_duplicate(template_hash, admin_id):
        """Check for duplicate biometric within admin scope"""
        try:
            # Search for existing template under this admin only
            existing_template = BiometricTemplate.objects.filter(
                admin_id=admin_id,
                template_hash=template_hash
            ).select_related('voter').first()
            
            if existing_template:
                logger.warning(f"Duplicate biometric detected under admin {admin_id}")
                return {
                    'is_duplicate': True,
                    'existing_voter': {
                        'id': str(existing_template.voter.id),
                        'name': existing_template.voter.full_name,
                        'aadhaar_masked': f"XXXX-XXXX-{existing_template.voter.aadhaar_number[-4:]}",
                        'verified_at': existing_template.created_at.isoformat()
                    }
                }
            
            return {'is_duplicate': False}
            
        except Exception as e:
            logger.error(f"Duplicate check failed: {str(e)}")
            raise e
    
    @staticmethod
    def store_template(voter_id, template_hash, quality_score, operator_id, admin_id):
        """Store biometric template with admin scoping"""
        try:
            with transaction.atomic():
                # Verify voter belongs to this admin
                voter = Voter.objects.get(id=voter_id, admin_id=admin_id)
                
                # Create biometric template
                template = BiometricTemplate.objects.create(
                    admin_id=admin_id,
                    voter=voter,
                    template_hash=template_hash,
                    scan_quality=quality_score,
                    operator_id=operator_id
                )
                
                # Mark voter as verified
                voter.verified_at = timezone.now()
                voter.operator_id = operator_id
                voter.save(update_fields=['verified_at', 'operator_id'])
            
            logger.info(f"Biometric template stored for voter {voter_id} under admin {admin_id}")
            
            return {
                'success': True,
                'message': 'Voter verified successfully - Proceed to EVM'
            }
            
        except Voter.DoesNotExist:
            logger.error(f"Voter {voter_id} not found under admin {admin_id}")
            raise Exception("Voter not found")
        except Exception as e:
            logger.error(f"Template storage failed: {str(e)}")
            raise e

class FraudDetectionService:
    """Service for fraud detection and logging with tenant isolation"""
    
    @staticmethod
    def log_fraud(fraud_type, admin_id, operator_id=None, **details):
        """Log fraud attempt with hierarchy scoping"""
        try:
            # Get admin user object from admin_id
            from accounts.models import Admin
            try:
                admin_user = Admin.objects.get(id=admin_id)
            except Admin.DoesNotExist:
                # Fallback to SuperAdmin if needed (though usually tenant bound)
                from accounts.models import SuperAdmin
                admin_user = SuperAdmin.objects.get(id=admin_id)
            
            fraud_log = FraudLog.objects.create(
                admin=admin_user,
                fraud_type=fraud_type,
                operator_id=operator_id,
                **details
            )
            
            logger.warning(f"Fraud logged: {fraud_type} under admin {admin_id}")
            return fraud_log
            
        except Exception as e:
            logger.error(f"Fraud logging failed: {str(e)}")
            raise e

class AuditService:
    """Service for audit logging with tenant isolation"""
    
    @staticmethod
    def log_action(action, user_type, user_id, admin_id, **details):
        """Log user action with hierarchy scoping"""
        try:
            # Get admin user object from admin_id
            from accounts.models import Admin
            admin_user = None
            
            if admin_id:
                try:
                    admin_user = Admin.objects.get(id=admin_id)
                except Admin.DoesNotExist:
                     from accounts.models import SuperAdmin
                     try:
                        admin_user = SuperAdmin.objects.get(id=admin_id)
                     except SuperAdmin.DoesNotExist:
                        pass
            
            audit_log = AuditLog.objects.create(
                admin=admin_user,
                action=action,
                user_type=user_type,
                user_id=user_id,
                **details
            )
            
            logger.info(f"Action logged: {action} by {user_type} under admin {admin_id}")
            return audit_log
            
        except Exception as e:
            logger.error(f"Audit logging failed: {str(e)}")
            # Don't raise - audit failures shouldn't break main flow
            pass