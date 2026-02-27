from accounts.constants import SystemRoles
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

        # 1. Search (Aadhaar, Booth)
        search_query = request.GET.get('search', '').strip()
        is_aadhaar_search = search_query and search_query.isdigit() and len(search_query) >= 4

        # Base Query
        if is_superuser:
            # SuperAdmin sees ALL logs
            queryset = FraudLog.objects.all().order_by('-flagged_at')
        else:
            # Admin sees only their tenant's logs UNLESS they are explicitly searching (Global Aadhaar Search)
            if search_query and is_aadhaar_search:
                queryset = FraudLog.objects.all().order_by('-flagged_at')
            else:
                queryset = FraudLog.objects.filter(admin_id=admin_id).order_by('-flagged_at')
            
        print(f"DEBUG: Query count: {queryset.count()}")

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
            
        # NEW: 3.1 Date Range Filter
        start_date = request.GET.get('start_date', '').strip()
        end_date = request.GET.get('end_date', '').strip()
        
        if start_date:
            queryset = queryset.filter(flagged_at__date__gte=start_date)
        if end_date:
            queryset = queryset.filter(flagged_at__date__lte=end_date)
            
        # NEW: 3.2 Booth Filter
        booth_id = request.GET.get('booth_id', '').strip()
        if booth_id:
             queryset = queryset.filter(booth_number__icontains=booth_id)

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
                # Allow access by UUID for global searching capabilities.
                log = FraudLog.objects.get(id=log_id)
            except FraudLog.DoesNotExist:
                return Response({'error': 'Fraud log not found or access denied'}, status=404)
            
        # 3. Mark as reviewed automatically
        if not log.reviewed:
            log.reviewed = True
            log.save()
            
        # 4. Fetch Real Voter Details
        voter_details = None
        if log.aadhaar_number:
            try:
                from verification.models import Voter
                from accounts.models import Admin, Operator
                voter = Voter.objects.filter(aadhaar_number=log.aadhaar_number).first()
                if voter:
                    # Trace geographic origin
                    orig_state, orig_district, orig_tehsil, orig_booth = "", "", "", ""
                    try:
                        orig_admin = Admin.objects.get(id=voter.admin_id)
                        orig_state = orig_admin.state
                        orig_district = orig_admin.district
                        orig_tehsil = orig_admin.tehsil
                        if voter.operator_id:
                            orig_op = Operator.objects.get(id=voter.operator_id)
                            orig_booth = orig_op.booth_id
                    except Exception as geo_e:
                        logger.warning(f"Could not footprint geo-origin: {geo_e}")

                    voter_details = {
                        'full_name': voter.full_name,
                        'full_name_hindi': voter.full_name_hindi,
                        'dob': voter.date_of_birth.strftime('%d/%m/%Y') if voter.date_of_birth else '',
                        'gender': voter.gender,
                        'full_address': voter.full_address,
                        'photo': voter.photo_base64 or voter.photo_url or '',
                        'mobile_number': voter.mobile_number,
                        'original_location': {
                            'state': orig_state,
                            'district': orig_district,
                            'tehsil': orig_tehsil,
                            'booth_id': orig_booth
                        }
                    }
            except Exception as v_err:
                logger.warning(f"Could not fetch voter details: {v_err}")
                voter_details = None

        # 5. Fetch Fraud History
        fraud_history = []
        if log.aadhaar_number:
            try:
                history_logs = FraudLog.objects.filter(aadhaar_number=log.aadhaar_number).exclude(id=log.id).order_by('-flagged_at')
                for hl in history_logs:
                    fraud_history.append({
                        'id': str(hl.id),
                        'fraud_type': hl.fraud_type,
                        'flagged_at': hl.flagged_at.isoformat(),
                        'booth_number': hl.booth_number,
                        'reviewed': hl.reviewed
                    })
            except Exception as h_err:
                logger.warning(f"Could not fetch fraud history: {h_err}")

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
            'voter': voter_details,
            'fraud_history': fraud_history
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
        from accounts.constants import SystemRoles
        is_superuser = False
        admin_id = None
        
        user_role = getattr(request.user, 'role', None)
        if user_role == SystemRoles.SUPERUSER or getattr(request.user, 'is_superuser', False):
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
        from accounts.constants import SystemRoles
        is_superuser = False
        admin_id = None
        
        user_role = getattr(request.user, 'role', None)
        if user_role == SystemRoles.SUPERUSER or getattr(request.user, 'is_superuser', False):
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

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def operator_report_fraud(request):
    """Operator-facing endpoint to manually report a fraud incident"""
    user = request.user
    role = getattr(user, 'role', '')
    
    if role != SystemRoles.OPERATOR:
        return Response({'error': 'Only operators can report incidents'}, status=403)
    
    if not user.created_by:
        return Response({'error': 'Operator not properly configured'}, status=403)
    
    fraud_type = request.data.get('fraud_type', '').strip()
    aadhaar_number = request.data.get('aadhaar_number', '').strip()
    description = request.data.get('description', '').strip()
    severity = request.data.get('severity', 'medium').strip()
    
    if not fraud_type:
        return Response({'error': 'Fraud type is required'}, status=400)
    
    VALID_TYPES = ['suspicious_activity', 'impersonation', 'technical_issue', 'unauthorized_access', 'duplicate_biometric', 'already_voted', 'other']
    if fraud_type not in VALID_TYPES:
        return Response({'error': f'Invalid fraud type. Use: {", ".join(VALID_TYPES)}'}, status=400)
    
    if aadhaar_number and (len(aadhaar_number) != 12 or not aadhaar_number.isdigit()):
        return Response({'error': 'Aadhaar must be 12 digits'}, status=400)
    
    try:
        fraud_log = FraudLog.objects.create(
            fraud_type=fraud_type,
            aadhaar_number=aadhaar_number or '',
            operator=user,
            booth_number=user.booth_id or '',
            admin=user.created_by,
            details={
                'description': description,
                'severity': severity,
                'reported_by': 'operator',
                'operator_name': user.name,
                'ip_address': request.META.get('REMOTE_ADDR', ''),
            }
        )
        
        # Audit log
        from verification.services import AuditService
        try:
            AuditService.log_action(
                action='fraud_reported',
                user_type='operator',
                user_id=user.id,
                admin_id=user.created_by.id,
                details={'fraud_type': fraud_type, 'fraud_log_id': str(fraud_log.id)},
                ip_address=request.META.get('REMOTE_ADDR')
            )
        except Exception:
            pass
        
        return Response({
            'success': True,
            'message': 'Incident reported successfully',
            'id': str(fraud_log.id)
        }, status=201)
        
    except Exception as e:
        logger.error(f"Operator fraud report error: {e}")
        return Response({'error': 'Failed to submit report'}, status=500)