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
    AUTH_URL = "https://api.sandbox.co.in/authenticate"
    
    # Demo voter names pool
    DEMO_NAMES = [
        ("राजेश कुमार", "Rajesh Kumar"),
        ("प्रिया शर्मा", "Priya Sharma"),
        ("अमित सिंह", "Amit Singh"),
        ("सुनीता देवी", "Sunita Devi"),
        ("विकास गुप्ता", "Vikas Gupta"),
        ("अनीता वर्मा", "Anita Verma"),
        ("संजय पटेल", "Sanjay Patel"),
        ("रीता यादव", "Rita Yadav"),
        ("मनोज तिवारी", "Manoj Tiwari"),
        ("कविता मिश्रा", "Kavita Mishra"),
    ]
    
    @staticmethod
    def get_valid_token():
        """Retrieve Sandbox API token, fetching a new one if expired"""
        cache_key = 'sandbox_api_token'
        token = cache.get(cache_key)
        
        if token:
            return token
            
        # Token not in cache, generate new one
        auth_headers = {
            "x-api-key": getattr(settings, 'SANDBOX_API_KEY', ''),
            "x-api-secret": getattr(settings, 'SANDBOX_API_SECRET', '')
        }
        
        try:
            response = requests.post(AadhaarService.AUTH_URL, headers=auth_headers, timeout=10)
            if response.status_code == 200:
                token = response.json().get("access_token")
                if token:
                    # Sandbox tokens are valid for 24 hours. Cache for 23.5 hours to be safe.
                    cache.set(cache_key, token, timeout=23 * 3600 + 1800)
                    return token
        except Exception as e:
            logger.error(f"Failed to fetch Sandbox API token dynamically: {str(e)}")
            
        raise Exception("Failed to acquire valid Aadhaar API authentication token.")

    @staticmethod
    def send_otp(aadhaar_number, admin_id):
        """Send OTP to Aadhaar registered mobile - supports DEMO_MODE"""
        try:
            # Rate limiting per admin
            rate_key = f"otp_rate_{admin_id}_{aadhaar_number}"
            if cache.get(rate_key, 0) >= settings.MAX_OTP_ATTEMPTS:
                raise Exception("Rate limit exceeded for this Aadhaar")
            
            # ═══════════════════════════════════════════
            # DEMO MODE: Skip Sandbox API entirely
            # ═══════════════════════════════════════════
            if getattr(settings, 'DEMO_MODE', False):
                reference_id = f"demo_{aadhaar_number}_{timezone.now().strftime('%Y%m%d%H%M%S')}"
                expires_at = timezone.now() + timedelta(minutes=settings.OTP_EXPIRY_MINUTES)
                
                with transaction.atomic():
                    OTPCode.objects.filter(
                        admin_id=admin_id,
                        aadhaar_number=aadhaar_number,
                        is_used=False
                    ).update(is_used=True)
                    
                    OTPCode.objects.create(
                        admin_id=admin_id,
                        aadhaar_number=aadhaar_number,
                        otp_code=getattr(settings, 'DEMO_OTP', '123456'),
                        reference_id=reference_id,
                        expires_at=expires_at
                    )
                
                cache.set(rate_key, cache.get(rate_key, 0) + 1, timeout=3600)
                logger.info(f"[DEMO] OTP created for Aadhaar {aadhaar_number}")
                
                return {
                    'success': True,
                    'message': 'OTP sent successfully to registered mobile number',
                    'reference_id': reference_id,
                    'expires_at': expires_at.isoformat()
                }
            
            # ═══════════════════════════════════════════
            # PRODUCTION: Call Sandbox API
            # ═══════════════════════════════════════════
            token = AadhaarService.get_valid_token()
            headers = {
                "accept": "application/json",
                "authorization": token,
                "x-api-key": settings.SANDBOX_API_KEY,
                "x-api-version": "2.0",
                "content-type": "application/json"
            }
            
            payload = {
                "@entity": "in.co.sandbox.kyc.aadhaar.okyc.otp.request",
                "aadhaar_number": aadhaar_number,
                "consent": "y",
                "reason": "For KYC verification"
            }
            
            response = requests.post(
                AadhaarService.SEND_OTP_URL,
                json=payload,
                headers=headers,
                timeout=30
            )
            
            response_data = response.json()
            
            if response.status_code == 200 and response_data.get('data'):
                data_dict = response_data['data']
                
                # Check if Sandbox returned a rate limiting message instead of a reference ID
                if 'message' in data_dict and 'reference_id' not in data_dict:
                    raise Exception(data_dict['message'])
                    
                reference_id = data_dict.get('reference_id')
                
                if not reference_id:
                    raise Exception("No reference_id in API response")
                
                expires_at = timezone.now() + timedelta(minutes=settings.OTP_EXPIRY_MINUTES)
                
                with transaction.atomic():
                    OTPCode.objects.filter(
                        admin_id=admin_id,
                        aadhaar_number=aadhaar_number,
                        is_used=False
                    ).update(is_used=True)
                    
                    otp_record = OTPCode.objects.create(
                        admin_id=admin_id,
                        aadhaar_number=aadhaar_number,
                        otp_code="",
                        reference_id=reference_id,
                        expires_at=expires_at
                    )
                
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
        """Verify OTP and retrieve Aadhaar details - supports DEMO_MODE"""
        try:
            # Find latest OTP record
            otp_record = OTPCode.objects.filter(
                admin_id=admin_id,
                aadhaar_number=aadhaar_number,
                is_used=False
            ).order_by('-created_at').first()
            
            if not otp_record:
                return {'success': False, 'error': 'No OTP request found. Please request OTP first.'}
            
            if otp_record.is_expired:
                return {'success': False, 'error': 'OTP expired. Please request a new OTP.'}
            
            # Increment attempts
            otp_record.attempts += 1
            otp_record.save()
            
            if otp_record.attempts > settings.MAX_OTP_ATTEMPTS:
                otp_record.is_used = True
                otp_record.save()
                return {'success': False, 'error': 'Maximum attempts exceeded'}
            
            # ═══════════════════════════════════════════
            # DEMO MODE: Accept demo OTP and return dummy voter
            # ═══════════════════════════════════════════
            if getattr(settings, 'DEMO_MODE', False):
                expected_otp = getattr(settings, 'DEMO_OTP', '123456')
                if otp_code != expected_otp:
                    return {'success': False, 'error': f'Invalid OTP. (Demo: use {expected_otp})'}
                
                # Mark OTP as used
                otp_record.is_used = True
                otp_record.save()
                
                # Generate demo voter data based on Aadhaar (deterministic)
                idx = int(aadhaar_number[-2:]) % len(AadhaarService.DEMO_NAMES)
                name_hindi, name_en = AadhaarService.DEMO_NAMES[idx]
                
                gender = 'Male' if int(aadhaar_number[-1]) % 2 == 0 else 'Female'
                dob_year = 1970 + (int(aadhaar_number[-4:-2]) % 40)
                dob_month = (int(aadhaar_number[-3]) % 12) + 1
                dob_day = (int(aadhaar_number[-2]) % 28) + 1
                
                voter, created = Voter.objects.get_or_create(
                    aadhaar_number=aadhaar_number,
                    defaults={
                        'admin_id': admin_id,
                        'full_name': name_en,
                        'full_name_hindi': name_hindi,
                        'date_of_birth': f'{dob_year}-{dob_month:02d}-{dob_day:02d}',
                        'gender': gender,
                        'mobile_number': f'+91-XXXXX{aadhaar_number[-4:]}',
                        'full_address': 'Demo Address, New Delhi - 110001',
                        'photo_base64': '',
                    }
                )
                
                logger.info(f"[DEMO] OTP verified for Aadhaar {aadhaar_number}")
                
                return {
                    'success': True,
                    'voter': {
                        'id': str(voter.id),
                        'full_name': voter.full_name,
                        'full_name_hindi': voter.full_name_hindi,
                        'aadhaar_masked': f"XXXX XXXX {aadhaar_number[-4:]}",
                        'gender': voter.gender,
                        'date_of_birth': str(voter.date_of_birth),
                        'full_address': voter.full_address,
                        'photo_base64': voter.photo_base64,
                        'has_voted': voter.has_voted,
                    }
                }
            
            # ═══════════════════════════════════════════
            # PRODUCTION: Verify with Sandbox API
            # ═══════════════════════════════════════════
            if not otp_record.reference_id:
                return {'success': False, 'error': 'Invalid OTP session. Please request OTP again.'}
            
            token = AadhaarService.get_valid_token()
            headers = {
                "accept": "application/json",
                "authorization": token,
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
                timeout=30
            )
            
            response_data = response.json()
            
            if response.status_code == 200 and response_data.get('data', {}).get('status') == 'VALID':
                otp_record.is_used = True
                otp_record.save()
                
                data = response_data['data']
                
                # Compose full address from nested address dict
                addr = data.get('address', {})
                address_parts = [
                    addr.get('house'),
                    addr.get('street'),
                    addr.get('loc'),
                    addr.get('vtc'),
                    addr.get('dist'),
                    addr.get('state'),
                    addr.get('pc')
                ]
                # Filter out None and empty strings
                full_address_str = ", ".join([p for p in address_parts if p])
                
                # The Sandbox sometimes returns 'photo' or places it inside 'photo_link' etc.
                photo_b64 = data.get('photo_link', '') or data.get('photo', '')
                
                # Parse Date of Birth (Sandbox sends DD-MM-YYYY, PostgreSQL needs YYYY-MM-DD)
                raw_dob = data.get('date_of_birth')
                formatted_dob = timezone.now().date()
                if raw_dob:
                    from datetime import datetime
                    try:
                        formatted_dob = datetime.strptime(raw_dob, "%d-%m-%Y").strftime("%Y-%m-%d")
                    except ValueError:
                        try:
                            # Fallback if it's already YYYY-MM-DD
                            formatted_dob = datetime.strptime(raw_dob, "%Y-%m-%d").strftime("%Y-%m-%d")
                        except ValueError:
                            pass
                
                voter, created = Voter.objects.get_or_create(
                    aadhaar_number=aadhaar_number,
                    defaults={
                        'admin_id': admin_id,
                        'full_name': data.get('name', ''),
                        'full_name_hindi': data.get('name_hindi', ''),
                        'date_of_birth': formatted_dob,
                        'gender': data.get('gender', 'Other'),
                        'mobile_number': data.get('mobile_number', ''),
                        'full_address': full_address_str or data.get('full_address', ''),
                        'photo_base64': photo_b64,
                    }
                )
                
                logger.info(f"OTP verified for Aadhaar {aadhaar_number}")
                
                return {
                    'success': True,
                    'voter': {
                        'id': str(voter.id),
                        'full_name': voter.full_name,
                        'full_name_hindi': voter.full_name_hindi,
                        'aadhaar_masked': f"XXXX XXXX {aadhaar_number[-4:]}",
                        'gender': voter.gender,
                        'date_of_birth': str(voter.date_of_birth),
                        'full_address': voter.full_address,
                        'photo_base64': voter.photo_base64,
                        'has_voted': voter.has_voted,
                    }
                }
            else:
                logger.warning(f"Sandbox Verification Rejected: {response_data}")
                error_msg = response_data.get('data', {}).get('message', 'Invalid OTP')
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
            # Search for existing template across the entire system globally
            existing_template = BiometricTemplate.objects.filter(
                template_hash=template_hash
            ).first()
            
            if existing_template:
                voter = Voter.objects.filter(id=existing_template.voter_id).first()
                voter_name = voter.full_name if voter else "Unknown"
                
                aadhaar_masked = f"XXXX-XXXX-{voter.aadhaar_number[-4:]}" if voter else ""
                
                # Trace geographic origin
                state, district, tehsil, booth = "", "", "", ""
                try:
                    from accounts.models import Admin, Operator
                    orig_admin = Admin.objects.get(id=existing_template.admin_id)
                    state = orig_admin.state
                    district = orig_admin.district
                    tehsil = orig_admin.tehsil
                    if existing_template.operator_id:
                        orig_operator = Operator.objects.get(id=existing_template.operator_id)
                        booth = orig_operator.booth_id
                    elif hasattr(voter, 'operator_id') and voter.operator_id:
                        orig_operator = Operator.objects.get(id=voter.operator_id)
                        booth = orig_operator.booth_id
                except Exception as geo_err:
                    logger.warning(f"Failed to fetch geographic origin for duplicate {template_hash}: {geo_err}")

                logger.warning(f"Duplicate biometric detected under admin {admin_id}")
                return {
                    'is_duplicate': True,
                    'existing_voter': {
                        'id': str(existing_template.voter_id),
                        'name': voter_name,
                        'aadhaar_masked': aadhaar_masked,
                        'verified_at': existing_template.created_at.isoformat(),
                        'original_location': {
                            'state': state,
                            'district': district,
                            'tehsil': tehsil,
                            'booth_id': booth
                        }
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
                BiometricTemplate.objects.create(
                    admin_id=admin_id,
                    voter_id=voter.id,
                    template_hash=template_hash,
                    scan_quality=quality_score,
                    operator_id=operator_id
                )
                
                # Mark voter as verified and voted
                voter.verified_at = timezone.now()
                voter.operator_id = operator_id
                voter.has_voted = True
                voter.save(update_fields=['verified_at', 'operator_id', 'has_voted'])
            
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