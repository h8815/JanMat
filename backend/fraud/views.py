from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.db.models import Count
from django.utils import timezone
import logging

from accounts.permissions import IsAdmin
from .models import FraudLog, AuditLog

logger = logging.getLogger(__name__)

@api_view(['GET'])
@permission_classes([IsAuthenticated, IsAdmin])
def fraud_logs(request):
    """Get fraud logs with tenant isolation"""
    try:
        admin_user = request.user
        admin_id = admin_user.id if admin_user.is_superuser else admin_user.admin.id
        
        # Only show fraud logs under this admin
        logs = FraudLog.objects.filter(admin_id=admin_id).order_by('-flagged_at')[:100]
        
        fraud_data = []
        for log in logs:
            fraud_data.append({
                'id': str(log.id),
                'fraud_type': log.fraud_type,
                'aadhaar_masked': f"XXXX-XXXX-{log.aadhaar_number[-4:]}" if log.aadhaar_number else '',
                'booth_number': log.booth_number,
                'flagged_at': log.flagged_at.isoformat(),
                'reviewed': log.reviewed,
                'details': log.details
            })
        
        return Response(fraud_data)
    except Exception as e:
        logger.error(f"Fraud logs error: {str(e)}")
        return Response({
            'error': 'Failed to load fraud logs'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['GET'])
@permission_classes([IsAuthenticated, IsAdmin])
def fraud_stats(request):
    """Get fraud statistics with tenant isolation"""
    try:
        admin_user = request.user
        admin_id = admin_user.id if admin_user.is_superuser else admin_user.admin.id
        
        today = timezone.now().date()
        
        # Fraud statistics scoped to this admin
        stats = {
            'total_fraud_alerts': FraudLog.objects.filter(admin_id=admin_id).count(),
            'fraud_alerts_today': FraudLog.objects.filter(
                admin_id=admin_id,
                flagged_at__date=today
            ).count(),
            'fraud_by_type': dict(
                FraudLog.objects.filter(admin_id=admin_id)
                .values('fraud_type')
                .annotate(count=Count('fraud_type'))
                .values_list('fraud_type', 'count')
            ),
            'unreviewed_alerts': FraudLog.objects.filter(
                admin_id=admin_id,
                reviewed=False
            ).count()
        }
        
        return Response(stats)
    except Exception as e:
        logger.error(f"Fraud stats error: {str(e)}")
        return Response({
            'error': 'Failed to load fraud statistics'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['GET'])
@permission_classes([IsAuthenticated, IsAdmin])
def fraud_log_detail(request, log_id):
    """Get full details of a fraud log (unmasks data and marks as reviewed)"""
    try:
        admin_user = request.user
        
        # Robust Admin ID extraction
        if hasattr(admin_user, 'is_superuser') and admin_user.is_superuser:
             # If superuser, they can see any log, OR they act as an admin?
             # For tenant isolation, we usually need a specific admin_id. 
             # If superuser, let's bypass the admin_id check or fetch the log directly.
             log = FraudLog.objects.get(id=log_id)
             admin_id = log.admin_id # Use the log's admin for voter lookup
        else:
             # Validates that the user is the owner of the log
             admin_id = admin_user.id
             try:
                 log = FraudLog.objects.get(id=log_id, admin_id=admin_id)
             except FraudLog.DoesNotExist:
                 return Response({'error': 'Fraud log not found'}, status=404)
            
        # Mark as reviewed automatically
        if not log.reviewed:
            log.reviewed = True
            log.save()
            
        # Try to fetch real voter details if available
        voter_details = {}
        if log.aadhaar_number:
            from verification.models import Voter
            try:
                voter = Voter.objects.filter(aadhaar_number=log.aadhaar_number, admin_id=admin_id).first()
                if voter:
                    voter_details = {
                        'full_name': voter.full_name,
                        'full_name_hindi': voter.full_name_hindi,
                        'dob': voter.date_of_birth.strftime('%d/%m/%Y'),
                        'gender': voter.gender,
                        'address': voter.full_address,
                        'photo': voter.photo_base64 or voter.photo_url
                    }
            except Exception as v_err:
                logger.warning(f"Could not fetch voter details: {v_err}")

        data = {
            'id': str(log.id),
            'fraud_type': log.fraud_type,
            'aadhaar_number': log.aadhaar_number, # Unmasked
            'aadhaar_masked': f"XXXX-XXXX-{log.aadhaar_number[-4:]}" if log.aadhaar_number else '',
            'booth_number': log.booth_number,
            'flagged_at': log.flagged_at.isoformat(),
            'reviewed': log.reviewed,
            'details': log.details,
            'admin_notes': log.admin_notes,
            'voter': voter_details # Added real voter info
        }
        
        return Response(data)
    except Exception as e:
        logger.error(f"Fraud detail error: {str(e)}")
        return Response({
            'error': 'Failed to load details'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)