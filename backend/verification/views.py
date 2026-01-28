from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.db import transaction
from django.utils import timezone
from django.core.cache import cache
import logging

from .services import AadhaarService, BiometricService, FraudDetectionService, AuditService
from accounts.models import Operator

logger = logging.getLogger(__name__)

def require_operator_session(view_func):
    """Decorator to ensure only operators can access verification endpoints"""
    def wrapper(request, *args, **kwargs):
        if not hasattr(request, 'user') or not request.user.is_authenticated:
            return Response({'error': 'Authentication required'}, status=status.HTTP_401_UNAUTHORIZED)
        
        # Check custom role attribute set by authentication
        role = getattr(request.user, 'role', '')
        if role != 'OPERATOR':
             return Response({'error': 'Only booth operators can access this endpoint'}, status=status.HTTP_403_FORBIDDEN)
        
        # Ensure operator has admin (tenant isolation)
        # In new model, 'created_by' is the admin
        if not request.user.created_by:
            return Response({'error': 'Operator not properly configured'}, status=status.HTTP_403_FORBIDDEN)
        
        return view_func(request, *args, **kwargs)
    return wrapper

@api_view(['POST'])
@permission_classes([IsAuthenticated])
@require_operator_session
def send_otp(request):
    """Send OTP to Aadhaar registered mobile with tenant isolation"""
    aadhaar_number = request.data.get('aadhaar_number', '').strip()
    
    if not aadhaar_number:
        return Response({'error': 'Aadhaar number is required'}, status=status.HTTP_400_BAD_REQUEST)
    
    if not aadhaar_number.isdigit() or len(aadhaar_number) != 12:
         return Response({'error': 'Invalid Aadhaar number format'}, status=400)
    
    try:
        # Use created_by as admin reference
        admin_id = request.user.created_by.id
        result = AadhaarService.send_otp(aadhaar_number, admin_id)
        
        AuditService.log_action(
            action='otp_sent',
            user_type='operator',
            user_id=request.user.id,
            admin_id=admin_id,
            details={'aadhaar_masked': f"XXXX-XXXX-{aadhaar_number[-4:]}"},
            ip_address=request.META.get('REMOTE_ADDR')
        )
        
        return Response({
            'success': True,
            'message': result['message'],
            'expires_at': result['expires_at']
        })
        
    except Exception as e:
        logger.error(f"Send OTP failed: {str(e)}")
        return Response({'error': 'Failed to send OTP. Please try again.'}, status=500)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
@require_operator_session
def verify_otp(request):
    """Verify OTP and return voter details with tenant isolation"""
    aadhaar_number = request.data.get('aadhaar_number', '').strip()
    otp_code = request.data.get('otp_code', '').strip() or request.data.get('otp', '').strip()
    
    if not aadhaar_number or not otp_code:
        return Response({'error': 'Aadhaar number and OTP are required'}, status=400)
    
    if len(aadhaar_number) != 12 or not aadhaar_number.isdigit():
        return Response({'error': 'Invalid Aadhaar'}, status=400)
    if len(otp_code) != 6 or not otp_code.isdigit():
         return Response({'error': 'Invalid OTP'}, status=400)
    
    try:
        admin_id = request.user.created_by.id
        result = AadhaarService.verify_otp(aadhaar_number, otp_code, admin_id)
        
        if not result['success']:
            AuditService.log_action(
                action='otp_verify_failed',
                user_type='operator',
                user_id=request.user.id,
                admin_id=admin_id,
                details={'aadhaar_masked': f"XXXX-XXXX-{aadhaar_number[-4:]}", 'error': result['error']},
                ip_address=request.META.get('REMOTE_ADDR')
            )
            return Response({'success': False, 'error': result['error']}, status=400)
        
        voter_data = result['voter']
        if voter_data.get('has_voted'):
            FraudDetectionService.log_fraud(
                fraud_type='already_voted',
                admin_id=admin_id,
                operator_id=request.user.id,
                aadhaar_number=aadhaar_number,
                details={'voter_id': voter_data['id'], 'ip_address': request.META.get('REMOTE_ADDR')}
            )
            return Response({
                'success': False,
                'error': 'This voter has already been marked as voted',
                'voter': voter_data,
                'fraud_alert': True
            }, status=409)
        
        cache.set(f'voter_session_{admin_id}_{request.user.id}', {
            'voter_id': voter_data['id'],
            'aadhaar_number': aadhaar_number
        }, timeout=300)
        
        AuditService.log_action(
            action='otp_verified',
            user_type='operator',
            user_id=request.user.id,
            admin_id=admin_id,
            details={'aadhaar_masked': f"XXXX-XXXX-{aadhaar_number[-4:]}"},
            ip_address=request.META.get('REMOTE_ADDR')
        )
        
        return Response({'success': True, 'voter': voter_data})
        
    except Exception as e:
        logger.error(f"OTP verify error: {e}")
        return Response({'error': 'Service unavailable'}, status=503)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
@require_operator_session
def biometric_scan(request):
    """Process biometric scan"""
    biometric_data = request.data.get('biometric_data')
    quality_score = request.data.get('quality_score', 75)
    
    if not biometric_data:
        return Response({'error': 'Biometric data required'}, status=400)
    
    admin_id = request.user.created_by.id
    voter_session = cache.get(f'voter_session_{admin_id}_{request.user.id}')
    
    if not voter_session:
        return Response({'error': 'No active voter session'}, status=400)
    
    voter_id = voter_session['voter_id']
    aadhaar_number = voter_session['aadhaar_number']
    
    try:
        template_hash = BiometricService.generate_template_hash(biometric_data, quality_score)
        duplicate_check = BiometricService.check_duplicate(template_hash, admin_id)
        
        if duplicate_check['is_duplicate']:
            FraudDetectionService.log_fraud(
                fraud_type='duplicate_biometric',
                admin_id=admin_id,
                operator_id=request.user.id,
                aadhaar_number=aadhaar_number,
                biometric_hash=template_hash,
                details={'current_voter_id': voter_id, 'existing_voter': duplicate_check['existing_voter'], 'quality': quality_score}
            )
            
            AuditService.log_action(
                action='fraud_flagged',
                user_type='operator',
                user_id=request.user.id,
                admin_id=admin_id,
                details={'fraud_type': 'duplicate_biometric', 'aadhaar': aadhaar_number},
                ip_address=request.META.get('REMOTE_ADDR')
            )
            
            return Response({
                'status': 'fraud',
                'error': 'Duplicate biometric detected',
                'existing_voter': duplicate_check['existing_voter']
            }, status=409)
        
        result = BiometricService.store_template(
            voter_id=voter_id,
            template_hash=template_hash,
            quality_score=quality_score,
            operator_id=request.user.id,
            admin_id=admin_id
        )
        
        cache.delete(f'voter_session_{admin_id}_{request.user.id}')
        
        AuditService.log_action(
            action='biometric_scan',
            user_type='operator',
            user_id=request.user.id,
            admin_id=admin_id,
            details={'voter_id': voter_id, 'quality': quality_score},
            ip_address=request.META.get('REMOTE_ADDR')
        )
        
        return Response({
            'status': 'unique',
            'success': True,
            'message': result['message']
        })
        
    except Exception as e:
        logger.error(f"Biometric error: {e}")
        return Response({'error': 'Service unavailable'}, status=503)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
@require_operator_session
def current_session(request):
    """Get current session info"""
    admin_id = request.user.created_by.id
    voter_session = cache.get(f'voter_session_{admin_id}_{request.user.id}', {})
    
    # Request.user IS the operator now
    operator_info = {
        'booth_id': request.user.booth_id,
        'full_name': request.user.name
    }
    
    return Response({
        'operator': operator_info,
        'current_voter_id': voter_session.get('voter_id'),
        'current_aadhaar': voter_session.get('aadhaar_number'),
        'admin_id': str(admin_id)
    })

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def health_check(request):
    return Response({'status': 'healthy', 'time': timezone.now().isoformat()})