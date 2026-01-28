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