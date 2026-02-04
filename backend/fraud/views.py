from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.db.models import Count, Q
from django.core.paginator import Paginator
from django.utils import timezone
import logging

from accounts.permissions import IsAdmin
from .models import FraudLog, AuditLog

logger = logging.getLogger(__name__)

@api_view(['GET'])
@permission_classes([IsAuthenticated, IsAdmin])
def fraud_logs(request):
    """Get fraud logs with tenant isolation, search, filtering, and pagination"""
    try:
        # Determine Requesting User Context
        is_superuser = False
        admin_id = None
        
        if hasattr(request.user, 'is_superuser') and request.user.is_superuser:
            is_superuser = True
        
        # If not superuser, determine admin_id for tenant isolation
        if not is_superuser:
            if request.auth and 'admin_id' in request.auth:
                admin_id = request.auth['admin_id']
            else:
                # Fallback extraction
                admin_user = request.user
                if hasattr(admin_user, 'admin'):
                     admin_id = admin_user.admin.id
                elif hasattr(admin_user, 'admin_id'):
                     admin_id = admin_user.admin_id
                else:
                     admin_id = admin_user.id
            
            print(f"DEBUG: Filtering Fraud Logs for Admin ID: {admin_id}")

        # Base Query
        if is_superuser:
            # SuperAdmin sees ALL logs
            queryset = FraudLog.objects.all().order_by('-flagged_at')
        else:
            # Admin sees only their tenant's logs
            queryset = FraudLog.objects.filter(admin_id=admin_id).order_by('-flagged_at')
            
        print(f"DEBUG: Query count: {queryset.count()}")

        # 1. Search (Aadhaar, Booth)
        search_query = request.GET.get('search', '').strip()
        if search_query:
            queryset = queryset.filter(
                Q(aadhaar_number__icontains=search_query) | 
                Q(booth_number__icontains=search_query)
            )

        # 2. Filter by Fraud Type
        fraud_type = request.GET.get('type', '')
        if fraud_type and fraud_type != 'all':
            queryset = queryset.filter(fraud_type=fraud_type)

        # 3. Filter by Status
        status_filter = request.GET.get('status', '')
        if status_filter == 'reviewed':
            queryset = queryset.filter(reviewed=True)
        elif status_filter == 'pending':
            queryset = queryset.filter(reviewed=False)

        # 4. Pagination
        page_number = int(request.GET.get('page', 1))
        page_size = int(request.GET.get('limit', 20))
        paginator = Paginator(queryset, page_size)
        
        try:
            page_obj = paginator.page(page_number)
        except Exception:
            page_obj = paginator.page(1) # Fallback to page 1

        fraud_data = []
        for log in page_obj:
            fraud_data.append({
                'id': str(log.id),
                'fraud_type': log.fraud_type,
                'aadhaar_masked': f"XXXX-XXXX-{log.aadhaar_number[-4:]}" if log.aadhaar_number else '',
                'booth_number': log.booth_number,
                'flagged_at': log.flagged_at.isoformat(),
                'reviewed': log.reviewed,
                'details': log.details
            })
        
        return Response({
            'logs': fraud_data,
            'total': paginator.count,
            'page': page_obj.number,
            'pages': paginator.num_pages,
            'has_next': page_obj.has_next(),
            'has_previous': page_obj.has_previous()
        })
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
        is_superuser = False
        admin_id = None
        
        if hasattr(request.user, 'is_superuser') and request.user.is_superuser:
            is_superuser = True
            
        if not is_superuser:
            # Robustly get admin_id from token
            if request.auth and 'admin_id' in request.auth:
                admin_id = request.auth['admin_id']
            else:
                admin_user = request.user
                admin_id = getattr(admin_user, 'admin_id', admin_user.id)
                if hasattr(admin_user, 'admin'):
                     admin_id = admin_user.admin.id
        
        today = timezone.now().date()
        
        # Prepare filters
        base_filter = {}
        if not is_superuser:
            base_filter['admin_id'] = admin_id
            
        # Fraud statistics scoped
        stats = {
            'total_fraud_alerts': FraudLog.objects.filter(**base_filter).count(),
            'fraud_alerts_today': FraudLog.objects.filter(
                flagged_at__date=today, **base_filter
            ).count(),
            'fraud_by_type': dict(
                FraudLog.objects.filter(**base_filter)
                .values('fraud_type')
                .annotate(count=Count('fraud_type'))
                .values_list('fraud_type', 'count')
            ),
            'unreviewed_alerts': FraudLog.objects.filter(
                reviewed=False, **base_filter
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
        # 1. Determine Requesting User Context
        admin_user = request.user
        is_superuser = hasattr(admin_user, 'is_superuser') and admin_user.is_superuser
        
        # Determine the admin_id context from the request (for permission check if not superuser)
        request_admin_id = None
        if request.auth and 'admin_id' in request.auth:
            request_admin_id = request.auth['admin_id']
        else:
            # Fallback for session auth/superuser
            if hasattr(admin_user, 'admin'):
                 request_admin_id = admin_user.admin.id
            elif hasattr(admin_user, 'admin_id'):
                 request_admin_id = admin_user.admin_id
            else:
                 request_admin_id = admin_user.id
        
        # 2. Fetch Log
        if is_superuser:
            try:
                log = FraudLog.objects.get(id=log_id)
            except FraudLog.DoesNotExist:
                return Response({'error': 'Fraud log not found'}, status=404)
        else:
            try:
                # Ensure the log belongs to the requesting admin
                log = FraudLog.objects.get(id=log_id, admin_id=request_admin_id)
            except FraudLog.DoesNotExist:
                return Response({'error': 'Fraud log not found or access denied'}, status=404)
            
        # 3. Mark as reviewed automatically
        if not log.reviewed:
            log.reviewed = True
            log.save()
            
        # 4. Fetch Real Voter Details
        # We use log.admin_id to ensure we find the voter record belonging to the SAME tenant as the log.
        voter_details = None
        if log.aadhaar_number:
            try:
                from verification.models import Voter
                # Use log.admin.id (or log.admin_id) to find the voter in the correct scope
                voter = Voter.objects.filter(aadhaar_number=log.aadhaar_number, admin_id=log.admin_id).first()
                if voter:
                    voter_details = {
                        'full_name': voter.full_name,
                        'full_name_hindi': voter.full_name_hindi,
                        'dob': voter.date_of_birth.strftime('%d/%m/%Y') if voter.date_of_birth else '',
                        'gender': voter.gender,
                        'address': voter.full_address,
                        'photo': voter.photo_base64 or voter.photo_url or '',
                        'mobile_number': voter.mobile_number
                    }
            except Exception as v_err:
                logger.warning(f"Could not fetch voter details: {v_err}")
                voter_details = None

        data = {
            'id': str(log.id),
            'fraud_type': log.fraud_type,
            'aadhaar_number': log.aadhaar_number, 
            'aadhaar_masked': f"XXXX-XXXX-{log.aadhaar_number[-4:]}" if log.aadhaar_number and len(log.aadhaar_number) >= 4 else '',
            'booth_number': log.booth_number,
            'flagged_at': log.flagged_at.isoformat(),
            'reviewed': log.reviewed,
            'details': log.details,
            'admin_notes': log.admin_notes,
            'voter': voter_details 
        }
        
        return Response(data)
    except Exception as e:
        logger.error(f"Fraud detail error: {str(e)}", exc_info=True)
        return Response({
            'error': f'Failed to load details: {str(e)}'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['GET'])
@permission_classes([IsAuthenticated, IsAdmin])
def unread_fraud_count(request):
    """Get count of unreviewed fraud logs for notification badge"""
    try:
        is_superuser = False
        admin_id = None
        
        if hasattr(request.user, 'is_superuser') and request.user.is_superuser:
            is_superuser = True
            
        if not is_superuser:
            if request.auth and 'admin_id' in request.auth:
                admin_id = request.auth['admin_id']
            else:
                admin_user = request.user
                admin_id = getattr(admin_user, 'admin_id', admin_user.id)
                if hasattr(admin_user, 'admin'):
                     admin_id = admin_user.admin.id
        
        # Prepare filters
        base_filter = {}
        if not is_superuser:
            base_filter['admin_id'] = admin_id
            
        count = FraudLog.objects.filter(reviewed=False, **base_filter).count()
        
        return Response({'unread_count': count})
    except Exception as e:
        logger.error(f"Unread count error: {str(e)}")
        return Response({'error': 'Failed to fetch count'}, status=500)

@api_view(['POST'])
@permission_classes([IsAuthenticated, IsAdmin])
def mark_all_reviewed(request):
    """Mark all unreviewed fraud logs as reviewed for the current admin"""
    try:
        is_superuser = False
        admin_id = None
        
        if hasattr(request.user, 'is_superuser') and request.user.is_superuser:
            is_superuser = True
            
        if not is_superuser:
            if request.auth and 'admin_id' in request.auth:
                admin_id = request.auth['admin_id']
            else:
                admin_user = request.user
                admin_id = getattr(admin_user, 'admin_id', admin_user.id)
                if hasattr(admin_user, 'admin'):
                     admin_id = admin_user.admin.id
        
        # Prepare filters
        base_filter = {}
        if not is_superuser:
            base_filter['admin_id'] = admin_id
            
        updated_count = FraudLog.objects.filter(reviewed=False, **base_filter).update(reviewed=True)
        
        return Response({'success': True, 'updated_count': updated_count})
    except Exception as e:
        logger.error(f"Mark all reviewed error: {str(e)}")
        return Response({'error': 'Failed to update logs'}, status=500)