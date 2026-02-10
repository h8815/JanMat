from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken
from django.utils import timezone
from django.db import transaction
from django.db.models import Count, Q
from django.db.models.functions import TruncHour, TruncDay
from django.core.paginator import Paginator
from django.contrib.auth.hashers import check_password, make_password
import logging

from .models import SuperAdmin, Admin, Operator
from .serializers import (
    AdminLoginSerializer, 
    OperatorLoginSerializer, 
    ChangePasswordSerializer,
    AdminChangePasswordSerializer,
    CreateOperatorSerializer,
    SuperAdminSerializer,
    AdminSerializer,
    OperatorSerializer
)
from .permissions import IsAdmin
from fraud.models import FraudLog, AuditLog
from verification.models import Voter, BiometricTemplate
from verification.services import AuditService

logger = logging.getLogger(__name__)

def get_tokens_for_user(user, role):
    """Generate JWT tokens for user with custom claims"""
    # Create simple token manually since user models are non-standard
    refresh = RefreshToken()
    refresh['user_id'] = str(user.id)
    refresh['email'] = user.email
    refresh['role'] = role
    
    # Add tenant isolation info
    if role == 'ADMIN':
        refresh['admin_id'] = str(user.id)
    elif role == 'OPERATOR':
        refresh['admin_id'] = str(user.created_by.id) if user.created_by else None
        refresh['booth_id'] = user.booth_id
        refresh['full_name'] = user.name
    
    return {
        'refresh': str(refresh),
        'access': str(refresh.access_token),
    }

@api_view(['POST'])
@permission_classes([AllowAny])
def admin_login(request):
    """Login for SUPERUSER and ADMIN roles"""
    try:
        email = request.data.get('email')
        password = request.data.get('password')
        
        if not email or not password:
            return Response({'error': 'Email and password required'}, status=400)
        
        user = None
        role = None

        # 1. Try SuperAdmin
        try:
            sa = SuperAdmin.objects.get(email__iexact=email)
            if check_password(password, sa.password):
                user = sa
                role = 'SUPERUSER'
        except SuperAdmin.DoesNotExist:
            pass

        # 2. Try Admin if not found
        if not user:
            try:
                ad = Admin.objects.get(email__iexact=email)
                if check_password(password, ad.password):
                    user = ad
                    role = 'ADMIN'
            except Admin.DoesNotExist:
                pass

        if not user:
            logger.warning(f"Login failed: Invalid credentials for {email}")
            return Response({'error': 'Invalid credentials'}, status=401)
        
        if not user.is_active:
             return Response({'error': 'Account is disabled'}, status=401)
        
        # Update login time
        user.last_login = timezone.now()
        user.save(update_fields=['last_login'])

        tokens = get_tokens_for_user(user, role)
        
        # Determine serializer
        if role == 'SUPERUSER':
            user_data = SuperAdminSerializer(user).data
        else:
            user_data = AdminSerializer(user).data

        return Response({
            'access': tokens['access'],
            'refresh': tokens['refresh'],
            'role': role,
            'user': user_data
        })
        
    except Exception as e:
        logger.error(f"Login error: {str(e)}")
        return Response({'error': 'Login failed'}, status=500)

@api_view(['POST'])
@permission_classes([AllowAny])
def operator_login(request):
    """Operator login endpoint"""
    serializer = OperatorLoginSerializer(data=request.data)
    
    if not serializer.is_valid():
        return Response({'error': 'Invalid input', 'details': serializer.errors}, status=400)
    
    email = serializer.validated_data['email']
    password = serializer.validated_data['password']
    
    try:
        user = Operator.objects.select_related('created_by').get(email=email)
        
        if not check_password(password, user.password):
            return Response({'error': 'Invalid credentials'}, status=401)
            
        if not user.is_active:
             return Response({'error': 'Account is disabled'}, status=403)
        
        # Ensure operator has admin (tenant isolation)
        if not user.created_by:
            logger.error(f"Operator {email} has no admin assigned")
            return Response({'error': 'Configuration error'}, status=403)
        
        # Update last login
        user.last_login = timezone.now()
        user.save(update_fields=['last_login'])
        
        # Generate tokens
        tokens = get_tokens_for_user(user, 'OPERATOR')
        
        # Log successful login
        try:
            AuditService.log_action(
                action='login',
                user_type='operator',
                user_id=user.id,
                admin_id=user.created_by.id,
                ip_address=request.META.get('REMOTE_ADDR'),
                user_agent=request.META.get('HTTP_USER_AGENT', '')
            )
        except Exception as audit_error:
            logger.warning(f"Audit log failed: {audit_error}")
        
        response_data = {
            'access': tokens['access'],
            'refresh': tokens['refresh'],
            'role': 'OPERATOR',
            'user': OperatorSerializer(user).data,
            'admin_id': str(user.created_by.id)
        }
        
        if user.must_change_password:
            response_data['must_change_password'] = True
            
        return Response(response_data)
        
    except Operator.DoesNotExist:
        return Response({'error': 'Invalid credentials'}, status=401)
    except Exception as e:
        logger.error(f"Operator login error: {str(e)}")
        return Response({'error': 'Service unavailable'}, status=503)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def change_password(request):
    """Change operator password"""
    user = request.user
    role = getattr(user, 'role', '') # Attached by authentication backend
    
    if role != 'OPERATOR':
        return Response({'error': 'Only operators can change password here'}, status=403)
    
    serializer = ChangePasswordSerializer(data=request.data)
    if not serializer.is_valid():
        return Response({'error': 'Password should be at least 12 characters long', 'details': serializer.errors}, status=400)
    
    try:
        new_password = serializer.validated_data['new_password']
        
        user.password = make_password(new_password)
        user.must_change_password = False
        user.save(update_fields=['password', 'must_change_password'])
        
        # Log it
        if user.created_by:
            AuditService.log_action(
                action='password_changed',
                user_type='operator',
                user_id=user.id,
                admin_id=user.created_by.id,
                ip_address=request.META.get('REMOTE_ADDR')
            )
        
        return Response({'success': True, 'message': 'Password changed'})
        
    except Exception as e:
        return Response({'error': 'Change failed'}, status=500)

@api_view(['POST'])
@permission_classes([IsAuthenticated, IsAdmin])
def create_operator(request):
    """Admin-only endpoint to create operators"""
    serializer = CreateOperatorSerializer(data=request.data)
    if not serializer.is_valid():
        return Response({'error': 'Validation failed', 'details': serializer.errors}, status=400)
    
    try:
        creator = request.user
        creator_role = getattr(creator, 'role', '')
        
        # Determine Admin ID (Tenant Owner)
        admin_ref = None
        if creator_role == 'ADMIN':
            admin_ref = creator
        elif creator_role == 'SUPERUSER':
             # Allow superuser to own operator? Or fail?
             # For now assume superuser creates global operators (rare) or needs to pick an admin.
             # Simplified: If superuser, they act as admin. But our model says created_by=Admin.
             # This is tricky. Let's assume SU cannot create op directly without specifying admin.
             # Or we allow created_by=None (requires model change) or we make SuperAdmin inherit Admin? No.
             # We'll just reject SU for now or require them to pass admin_id (not in serializer yet).
             return Response({'error': 'Only Admins can create Operators currently'}, status=403)
        
        with transaction.atomic():
            operator = Operator.objects.create(
                email=serializer.validated_data['email'],
                password=make_password(serializer.validated_data['password']),
                name=serializer.validated_data.get('full_name', ''),
                booth_id=serializer.validated_data['booth_id'],
                created_by=admin_ref,
                must_change_password=True,
                is_active=True
            )
        
        AuditService.log_action(
            action='operator_created',
            user_type='admin',
            user_id=creator.id,
            admin_id=admin_ref.id,
            resource_type='operator',
            resource_id=operator.id,
            details={'email': operator.email, 'booth': operator.booth_id},
            ip_address=request.META.get('REMOTE_ADDR')
        )
        
        return Response({
            'success': True,
            'message': 'Operator created',
            'operator': OperatorSerializer(operator).data
        }, status=201)
        
    except Exception as e:
        logger.error(f"Create op error: {e}")
        return Response({'error': 'Failed to create operator'}, status=500)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def current_user(request):
    """Get current user info"""
    user = request.user
    role = getattr(user, 'role', 'UNKNOWN')
    
    data = {'role': role}
    
    if role == 'SUPERUSER':
        data['user'] = SuperAdminSerializer(user).data
    elif role == 'ADMIN':
        data['user'] = AdminSerializer(user).data
        data['admin_id'] = str(user.id)
    elif role == 'OPERATOR':
        data['user'] = OperatorSerializer(user).data
        if user.created_by:
            data['admin_id'] = str(user.created_by.id)
            
    return Response(data)

@api_view(['GET'])
@permission_classes([IsAuthenticated, IsAdmin])
def list_operators(request):
    """List operators with performance metrics"""
    try:
        user = request.user
        role = getattr(user, 'role', '')
        
        if role == 'ADMIN':
            operators = Operator.objects.filter(created_by=user)
        elif role == 'SUPERUSER':
            operators = Operator.objects.all()
        else:
            return Response([])
            
        # 1. Annotate with Fraud Counts (ForeignKey relationship)
        operators = operators.annotate(fraud_count=Count('fraudlog'))
        
        # 2. Get Verification Counts (Loose UUID relationship)
        # Map operator_id -> count
        op_ids = [op.id for op in operators]
        voter_counts = (
            Voter.objects.filter(operator_id__in=op_ids, verified_at__isnull=False)
            .values('operator_id')
            .annotate(count=Count('id'))
        )
        verification_map = {str(v['operator_id']): v['count'] for v in voter_counts if v['operator_id']}
        
        # 3. Construct Response
        data = []
        for op in operators:
            serialized = OperatorSerializer(op).data
            serialized['metrics'] = {
                'verifications': verification_map.get(str(op.id), 0),
                'fraud_flags': op.fraud_count
            }
            data.append(serialized)
            
        return Response(data)
    except Exception as e:
        logger.error(f"List Operators error: {e}")
        return Response({'error': 'Failed to load operators'}, status=500)

@api_view(['GET', 'PUT', 'DELETE'])
@permission_classes([IsAuthenticated, IsAdmin])
def manage_operator(request, pk):
    """Retrieve, update or delete an operator"""
    try:
        user = request.user
        role = getattr(user, 'role', '')
        
        # SuperUser or Admin who created it
        if role == 'SUPERUSER':
            operator = Operator.objects.get(pk=pk)
        elif role == 'ADMIN':
            operator = Operator.objects.get(pk=pk, created_by=user)
        else:
            return Response({'error': 'Unauthorized'}, status=403)
            
        if request.method == 'GET':
            return Response(OperatorSerializer(operator).data)
            
        elif request.method == 'PUT':
            serializer = OperatorSerializer(operator, data=request.data, partial=True)
            if serializer.is_valid():
                serializer.save()
                return Response(serializer.data)
            return Response(serializer.errors, status=400)
            
        elif request.method == 'DELETE':
            operator.delete()
            return Response({'message': 'Operator deleted successfully'}, status=204)
            
    except Operator.DoesNotExist:
        return Response({'error': 'Operator not found'}, status=404)
    except Exception as e:
        logger.error(f"Manage Operator error: {e}")
        return Response({'error': 'Operation failed'}, status=500)

@api_view(['POST'])
@permission_classes([IsAuthenticated, IsAdmin])
def bulk_operator_action(request):
    """Perform bulk actions on operators"""
    try:
        user = request.user
        role = getattr(user, 'role', '')
        
        ids = request.data.get('ids', [])
        action = request.data.get('action', '')
        
        if not ids or not isinstance(ids, list):
            return Response({'error': 'Invalid or empty ID list'}, status=400)
            
        if not action:
            return Response({'error': 'Action required'}, status=400)
            
        # Base Query: Filter by Admin Ownership (Tenant Isolation)
        if role == 'ADMIN':
            queryset = Operator.objects.filter(id__in=ids, created_by=user)
        elif role == 'SUPERUSER':
            queryset = Operator.objects.filter(id__in=ids)
        else:
            return Response({'error': 'Unauthorized'}, status=403)
            
        if not queryset.exists():
            return Response({'error': 'No valid operators found for this action'}, status=404)
        
        updated_count = 0
        
        if action == 'activate':
            updated_count = queryset.update(is_active=True)
            log_action = 'bulk_activate'
        elif action == 'deactivate':
            updated_count = queryset.update(is_active=False)
            log_action = 'bulk_deactivate'
        elif action == 'delete':
            # Store count before delete
            updated_count = queryset.count()
            queryset.delete()
            log_action = 'bulk_delete'
        else:
            return Response({'error': 'Invalid action. Use activate/deactivate/delete'}, status=400)
            
        # Audit Log
        try:
            AuditService.log_action(
                action=log_action,
                user_type='admin',
                user_id=user.id,
                admin_id=user.id if role == 'ADMIN' else None,
                resource_type='operator',
                details={'count': updated_count, 'ids': ids},
                ip_address=request.META.get('REMOTE_ADDR')
            )
        except Exception as audit_err:
            logger.warning(f"Audit log failed: {audit_err}")

        return Response({
            'success': True,
            'message': f'Successfully performed "{action}" on {updated_count} operators',
            'count': updated_count
        })

    except Exception as e:
        logger.error(f"Bulk action error: {e}")
        return Response({'error': 'Failed to perform bulk action'}, status=500)

@api_view(['GET'])
@permission_classes([IsAuthenticated, IsAdmin])
def admin_stats(request):
    """Admin dashboard stats"""
    try:
        user = request.user
        role = getattr(user, 'role', '')
        
        # Filter Key
        # If Admin, filter by admin_id=user.id
        # If SU, show global (admin_id not filtered)
        
        filters = {}
        if role == 'ADMIN':
            filters['admin_id'] = user.id
            op_filters = {'created_by': user}
            fraud_filters = {'admin': user}
        else:
            # SUPERUSER
            op_filters = {}
            fraud_filters = {}
            # For Models with admin_id field (Voter, Biometric, etc.)
            # We can't filter easily unless we pass nothing.
            
        today = timezone.now().date()
        
        stats = {
            'active_operators': Operator.objects.filter(is_active=True, **op_filters).count(),
            'total_operators': Operator.objects.filter(**op_filters).count(),
            'total_voters': Voter.objects.filter(**filters).count(),
            'verified_voters': Voter.objects.filter(
                verified_at__isnull=False, **filters
            ).count(),
            'fraud_alerts_today': FraudLog.objects.filter(
                flagged_at__date=today, **fraud_filters
            ).count(),
            'total_fraud_alerts': FraudLog.objects.filter(**fraud_filters).count(),
            'biometric_scans': BiometricTemplate.objects.filter(**filters).count(),
            'verifications_today': Voter.objects.filter(
                verified_at__date=today, **filters
            ).count(),
        }
        
        return Response(stats)
    except Exception as e:
        logger.error(f"Stats error: {e}")
        return Response({'error': 'Failed to load stats'}, status=500)

@api_view(['GET'])
@permission_classes([IsAuthenticated, IsAdmin])
def fraud_logs(request):
    """Get fraud logs"""
    try:
        user = request.user
        role = getattr(user, 'role', '')
        
        if role == 'ADMIN':
            logs = FraudLog.objects.filter(admin=user)
        else:
            logs = FraudLog.objects.all()
            
        logs = logs.order_by('-flagged_at')[:100]
        
        data = []
        for log in logs:
            data.append({
                'id': str(log.id),
                'fraud_type': log.fraud_type,
                'aadhaar_masked': f"XXXX-{log.aadhaar_number[-4:]}" if log.aadhaar_number else '',
                'booth_number': log.booth_number,
                'flagged_at': log.flagged_at.isoformat(),
                'reviewed': log.reviewed,
                'details': log.details
            })
        return Response(data)
    except Exception as e:
        return Response({'error': 'Failed to load logs'}, status=500)

@api_view(['GET'])
@permission_classes([AllowAny])
def health_check(request):
    return Response({'status': 'healthy', 'time': timezone.now().isoformat()})

@api_view(['POST'])
@permission_classes([IsAuthenticated, IsAdmin])
def admin_change_password(request):
    """Change admin password with old password verification"""
    user = request.user
    role = getattr(user, 'role', '')
    
    # Allow SuperAdmin as well if needed, but primarily for Admin
    if role not in ['ADMIN', 'SUPERUSER']:
        return Response({'error': 'Unauthorized'}, status=403)
        
    serializer = AdminChangePasswordSerializer(data=request.data)
    
    if not serializer.is_valid():
        return Response({'error': 'Validation failed', 'details': serializer.errors}, status=400)
        
    old_password = serializer.validated_data['old_password']
    new_password = serializer.validated_data['new_password']
    
    # verify old password
    if not check_password(old_password, user.password):
        return Response({'error': 'Incorrect current password'}, status=400)
        
    user.password = make_password(new_password)
    user.save(update_fields=['password'])
    
    # Log it
    try:
        AuditService.log_action(
            action='password_changed',
            user_type='admin',
            user_id=user.id,
            admin_id=user.id if role == 'ADMIN' else None, # Self-audit
            ip_address=request.META.get('REMOTE_ADDR')
        )
    except: pass
    
    return Response({'success': True, 'message': 'Password updated successfully'})

@api_view(['PUT'])
@permission_classes([IsAuthenticated, IsAdmin])
def update_admin_profile(request):
    """Update admin profile details"""
    user = request.user
    role = getattr(user, 'role', '')
    
    if role not in ['ADMIN', 'SUPERUSER']:
        return Response({'error': 'Unauthorized'}, status=403)

    # Use existing serializer
    if role == 'SUPERUSER':
        serializer = SuperAdminSerializer(user, data=request.data, partial=True)
    else:
        serializer = AdminSerializer(user, data=request.data, partial=True)

    if serializer.is_valid():
        # Check email uniqueness if changing
        new_email = serializer.validated_data.get('email')
        if new_email and new_email != user.email:
            if role == 'ADMIN' and Admin.objects.filter(email=new_email).exclude(id=user.id).exists():
                 return Response({'error': 'Email is already taken by another admin'}, status=400)
            if role == 'SUPERUSER' and SuperAdmin.objects.filter(email=new_email).exclude(id=user.id).exists():
                 return Response({'error': 'Email is already taken by another superadmin'}, status=400)

        serializer.save()
        
        # Log it
        try:
            AuditService.log_action(
                action='profile_updated',
                user_type='admin',
                user_id=user.id,
                admin_id=user.id if role == 'ADMIN' else None,
                ip_address=request.META.get('REMOTE_ADDR'),
                details={'updated_fields': list(request.data.keys())}
            )
        except: pass
        
        return Response({
            'success': True, 
            'message': 'Profile updated successfully',
            'user': serializer.data
        })
    
    return Response({'error': 'Validation failed', 'details': serializer.errors}, status=400)

from django.http import HttpResponse
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet

@api_view(['GET'])
@permission_classes([IsAuthenticated, IsAdmin])
def export_admin_report(request):
    """Export comprehensive PDF report for admin"""
    try:
        user = request.user
        role = getattr(user, 'role', '')
        
        # 1. Gather Data
        filters = {}
        if role == 'ADMIN':
            filters['admin_id'] = user.id
            op_filters = {'created_by': user}
            fraud_filters = {'admin': user}
        else:
            op_filters = {}
            fraud_filters = {}
            
        stats = {
            'Total Operators': Operator.objects.filter(**op_filters).count(),
            'Total Registered Voters': Voter.objects.filter(**filters).count(),
            'Verified Voters': Voter.objects.filter(verified_at__isnull=False, **filters).count(),
            'Fraud Alerts': FraudLog.objects.filter(**fraud_filters).count(),
        }

        operators = Operator.objects.filter(**op_filters).values_list('name', 'email', 'booth_id', 'is_active')
        operator_data = [['Name', 'Email', 'Booth ID', 'Status']] + [
            [op[0], op[1], op[2], 'Active' if op[3] else 'Inactive'] for op in operators
        ]

        fraud_logs = FraudLog.objects.filter(**fraud_filters).select_related('operator', 'admin').order_by('-flagged_at')[:50]
        
        fraud_data = [['Time', 'Type', 'Booth', 'Operator', 'Admin']]
        for log in fraud_logs:
            op_name = log.operator.name if log.operator else 'Unknown'
            # Fallback if name is empty but obj exists (e.g. just email)
            if log.operator and not op_name: op_name = log.operator.email
            
            admin_name = log.admin.name if log.admin else 'System'
            fraud_data.append([
                log.flagged_at.strftime("%Y-%m-%d %H:%M"),
                log.fraud_type.replace('_', ' ').title(),
                log.booth_number,
                op_name,
                admin_name
            ])

        # 2. Generate PDF
        response = HttpResponse(content_type='application/pdf')
        response['Content-Disposition'] = f'attachment; filename="admin_report_{timezone.now().date()}.pdf"'

        doc = SimpleDocTemplate(response, pagesize=letter)
        elements = []
        
        JANMAT_BLUE = colors.HexColor('#0B3D91')
        HEADER_BG = JANMAT_BLUE
        HEADER_TEXT = colors.whitesmoke
        
        # Helper for transparency since HexColor might not support alpha directly in this version
        def hex_to_rgb_alpha(hex_code, alpha=1):
            hex_code = hex_code.lstrip('#')
            r, g, b = tuple(int(hex_code[i:i+2], 16)/255.0 for i in (0, 2, 4))
            return colors.Color(r, g, b, alpha=alpha)

        ROW_BG = hex_to_rgb_alpha('#F8FAFC', 0.6)
        ROW_WHITE = hex_to_rgb_alpha('#FFFFFF', 0.4)
        
        styles = getSampleStyleSheet()
        title_style = styles['Title']
        title_style.textColor = JANMAT_BLUE
        
        heading_style = styles['Heading2']
        heading_style.textColor = JANMAT_BLUE
        heading_style.spaceBefore = 20
        heading_style.spaceAfter = 10

        # Title
        elements.append(Paragraph(f"JanMat Admin Report", title_style))
        elements.append(Paragraph(f"Date: {timezone.now().date()}", styles['Normal']))
        elements.append(Paragraph(f"Generated by: {user.email}", styles['Normal']))
        elements.append(Spacer(1, 20))

        # Stats Table
        elements.append(Paragraph("Key Statistics", heading_style))
        stats_data = [[k, str(v)] for k, v in stats.items()]
        t_stats = Table(stats_data, colWidths=[200, 100], hAlign='LEFT')
        t_stats.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (0, -1), colors.HexColor('#E2E8F0')),
            ('TEXTCOLOR', (0, 0), (0, -1), colors.black),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 10),
            ('TOPPADDING', (0, 0), (-1, -1), 10),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
        ]))
        elements.append(t_stats)
        
        # Operators Table - FIXED HEADERS
        elements.append(Paragraph("Operators List", heading_style))
        if len(operator_data) > 1:
            t_ops = Table(operator_data, repeatRows=1, colWidths=[120, 180, 100, 80], hAlign='LEFT')
            t_ops.setStyle(TableStyle([
                # Header Row Styling (row 0)
                ('BACKGROUND', (0, 0), (-1, 0), HEADER_BG),
                ('TEXTCOLOR', (0, 0), (-1, 0), HEADER_TEXT),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, 0), 10),
                ('TOPPADDING', (0, 0), (-1, 0), 8),
                ('BOTTOMPADDING', (0, 0), (-1, 0), 8),
                # Body Rows Styling (row 1 onwards)
                ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
                ('FONTSIZE', (0, 1), (-1, -1), 9),
                ('TOPPADDING', (0, 1), (-1, -1), 6),
                ('BOTTOMPADDING', (0, 1), (-1, -1), 6),
                ('TEXTCOLOR', (0, 1), (-1, -1), colors.black),
                ('ROWBACKGROUNDS', (0, 1), (-1, -1), [ROW_BG, ROW_WHITE]),
                # Grid
                ('GRID', (0, 0), (-1, -1), 0.5, colors.lightgrey),
            ]))
            elements.append(t_ops)
        else:
            elements.append(Paragraph("No operators found.", styles['Normal']))

        # Fraud Logs Table - FIXED HEADERS
        elements.append(Paragraph("Recent Fraud Alerts (Last 50)", heading_style))
        if len(fraud_data) > 1:
            t_fraud = Table(fraud_data, repeatRows=1, colWidths=[90, 110, 80, 120, 100], hAlign='LEFT')
            t_fraud.setStyle(TableStyle([
                # Header Row Styling (row 0)
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#DC2626')),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, 0), 9),
                ('TOPPADDING', (0, 0), (-1, 0), 8),
                ('BOTTOMPADDING', (0, 0), (-1, 0), 8),
                # Body Rows Styling (row 1 onwards)
                ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
                ('FONTSIZE', (0, 1), (-1, -1), 8),
                ('TOPPADDING', (0, 1), (-1, -1), 6),
                ('BOTTOMPADDING', (0, 1), (-1, -1), 6),
                ('TEXTCOLOR', (0, 1), (-1, -1), colors.black),
                ('ROWBACKGROUNDS', (0, 1), (-1, -1), [ROW_BG, ROW_WHITE]),
                # Grid
                ('GRID', (0, 0), (-1, -1), 0.5, colors.lightgrey),
            ]))
            elements.append(t_fraud)
        else:
            elements.append(Paragraph("No fraud alerts found.", styles['Normal']))

        # Audit Logs Table - FIXED HEADERS
        # Improved fetching logic
        audit_qs = AuditLog.objects.filter(admin_id=user.id) if role == 'ADMIN' else AuditLog.objects.all()
        audit_logs = audit_qs.order_by('-created_at')[:50]
        
        # Pre-fetch users for name mapping to avoid N+1 (simplified approach)
        admin_map = {str(a.id): a.name for a in Admin.objects.all()}
        op_map = {str(o.id): o.name or o.full_name for o in Operator.objects.all()}
        
        audit_table_data = [['Time', 'Action', 'Role', 'Username', 'IP']]
        
        for log in audit_logs:
            uid = str(log.user_id)
            username = 'Unknown'
            if log.user_type == 'admin':
                username = admin_map.get(uid, uid)
            elif log.user_type == 'operator':
                username = op_map.get(uid, uid)
            elif log.user_type == 'superadmin':
                username = 'SuperAdmin'
                
            audit_table_data.append([
                log.created_at.strftime("%Y-%m-%d %H:%M"),
                log.action,
                log.user_type.upper(),
                username,
                log.ip_address
            ])
        
        elements.append(Paragraph("Recent Audit Logs (Last 50)", heading_style))
        if len(audit_table_data) > 1:
            t_audit = Table(audit_table_data, repeatRows=1, colWidths=[90, 100, 70, 120, 100], hAlign='LEFT')
            t_audit.setStyle(TableStyle([
                # Header Row Styling (row 0)
                ('BACKGROUND', (0, 0), (-1, 0), JANMAT_BLUE),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, 0), 9),
                ('TOPPADDING', (0, 0), (-1, 0), 8),
                ('BOTTOMPADDING', (0, 0), (-1, 0), 8),
                # Body Rows Styling (row 1 onwards)
                ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
                ('FONTSIZE', (0, 1), (-1, -1), 8),
                ('TOPPADDING', (0, 1), (-1, -1), 6),
                ('BOTTOMPADDING', (0, 1), (-1, -1), 6),
                ('TEXTCOLOR', (0, 1), (-1, -1), colors.black),
                ('ROWBACKGROUNDS', (0, 1), (-1, -1), [ROW_BG, ROW_WHITE]),
                # Grid
                ('GRID', (0, 0), (-1, -1), 0.5, colors.lightgrey),
            ]))
            elements.append(t_audit)
        else:
             elements.append(Paragraph("No audit logs found.", styles['Normal']))

        # Watermark & Header Function
        def add_watermark(canvas, doc):
            canvas.saveState()
            import os
            from django.conf import settings
            
            # 1. Background Watermark (Ashoka Pillar)
            watermark_path = os.path.join(settings.BASE_DIR, 'static', 'assets', 'images', 'ashoka.png')
            if os.path.exists(watermark_path):
                img_width = 300
                img_height = 400
                canvas.setFillAlpha(0.35)
                try: 
                    # Center the watermark
                    canvas.drawImage(watermark_path, (letter[0] - img_width) / 2, (letter[1] - img_height) / 2, width=img_width, height=img_height, mask='auto', preserveAspectRatio=True)
                except Exception as img_err:
                    print(f"Watermark error: {img_err}")
                canvas.setFillAlpha(1)

            # 2. Top Right Logo (Ashoka Black)
            logo_path = os.path.join(settings.BASE_DIR, 'static', 'assets', 'images', 'ashoka-black.png')
            if os.path.exists(logo_path):
                logo_width = 50
                logo_height = 50
                try:
                    canvas.drawImage(logo_path, 530, 730, width=logo_width, height=logo_height, mask='auto', preserveAspectRatio=True)
                except Exception as logo_err:
                    print(f"Logo error: {logo_err}")

            canvas.restoreState()

        doc.build(elements, onFirstPage=add_watermark, onLaterPages=add_watermark)
        return response

    except Exception as e:
        logger.error(f"Export error: {e}")
        return Response({'error': 'Failed to generate report'}, status=500)

@api_view(['GET'])
@permission_classes([IsAuthenticated, IsAdmin])
def audit_logs(request):
    """Get audit logs with search, filtering, and pagination"""
    try:
        user = request.user
        role = getattr(user, 'role', '')
        
        # Base Query
        if role == 'ADMIN':
            queryset = AuditLog.objects.filter(admin_id=user.id)
        else:
            # Superuser
            queryset = AuditLog.objects.all()
            
        queryset = queryset.order_by('-created_at')

        # 1. Search (Action, Details, IP, Actor)
        search_query = request.GET.get('search', '').strip()
        if search_query:
            queryset = queryset.filter(
                Q(action__icontains=search_query) | 
                Q(details__icontains=search_query) |
                Q(ip_address__icontains=search_query) |
                Q(user_type__icontains=search_query)
            )

        # 2. Pagination
        page_number = int(request.GET.get('page', 1))
        page_size = int(request.GET.get('limit', 20))
        paginator = Paginator(queryset, page_size)
        
        try:
            page_obj = paginator.page(page_number)
        except Exception:
            page_obj = paginator.page(1)

        data = []
        for log in page_obj:
            data.append({
                'id': str(log.id),
                'action': log.action,
                'user_type': log.user_type,
                'user_id': str(log.user_id) if log.user_id else None,
                'resource_type': log.resource_type,
                'details': log.details,
                'ip_address': log.ip_address,
                'timestamp': log.created_at.isoformat()
            })
            
        return Response({
            'logs': data,
            'total': paginator.count,
            'page': page_obj.number,
            'pages': paginator.num_pages,
            'has_next': page_obj.has_next(),
            'has_previous': page_obj.has_previous()
        })
    except Exception as e:
        logger.error(f"Audit log error: {e}")
        return Response({'error': 'Failed to load audit logs'}, status=500)

@api_view(['GET'])
@permission_classes([IsAuthenticated, IsAdmin])
def voter_stats_chart(request):
    """Get voter statistics for charts (e.g., hourly/daily)"""
    try:
        user = request.user
        role = getattr(user, 'role', '')
        period = request.GET.get('period', '24h')
        
        filters = {}
        if role == 'ADMIN':
            filters['admin_id'] = user.id
            
        now = timezone.now()
        
        if period == '7d':
             start_time = now - timezone.timedelta(days=7)
             trunc_class = TruncDay
             date_format = '%Y-%m-%d'
             iterations = 7
             iter_delta = timezone.timedelta(days=1)
        elif period == '30d':
             start_time = now - timezone.timedelta(days=30)
             trunc_class = TruncDay
             date_format = '%Y-%m-%d'
             iterations = 30
             iter_delta = timezone.timedelta(days=1)
        else: # 24h
             start_time = now - timezone.timedelta(hours=24)
             trunc_class = TruncHour
             date_format = '%H:00'
             iterations = 24
             iter_delta = timezone.timedelta(hours=1)
        
        # Query Voters
        stats = (
            Voter.objects.filter(verified_at__gte=start_time, **filters)
            .annotate(period_group=trunc_class('verified_at'))
            .values('period_group')
            .annotate(count=Count('id'))
            .order_by('period_group')
        )
        
        # Query Fraud Logs
        fraud_filters = {}
        if role == 'ADMIN':
            fraud_filters['admin_id'] = user.id
            
        fraud_stats = (
            FraudLog.objects.filter(flagged_at__gte=start_time, **fraud_filters)
            .annotate(period_group=trunc_class('flagged_at'))
            .values('period_group')
            .annotate(count=Count('id'))
            .order_by('period_group')
        )

        data_map = {}
        for stat in stats:
             if stat['period_group']:
                 key = stat['period_group'].strftime(date_format)
                 data_map[key] = stat['count']

        fraud_map = {}
        for stat in fraud_stats:
             if stat['period_group']:
                 key = stat['period_group'].strftime(date_format)
                 fraud_map[key] = stat['count']

        # Fill gaps
        labels = []
        data = []
        fraud_data = []
        
        for i in range(iterations + 1):
             ts = now - (iter_delta * (iterations - i))
             key = ts.strftime(date_format)
             labels.append(key)
             data.append(data_map.get(key, 0))
             fraud_data.append(fraud_map.get(key, 0))
            
        return Response({
            'labels': labels,
            'data': data,
            'fraud_data': fraud_data
        })
    except Exception as e:
        logger.error(f"Chart stats error: {e}")
        return Response({'error': 'Failed to load chart data'}, status=500)

@api_view(['GET'])
@permission_classes([IsAuthenticated, IsAdmin])
def booth_activity_heatmap(request):
    """Get heatmap data: Booth vs Hour of Day (Last 24h)"""
    try:
        user = request.user
        role = getattr(user, 'role', '')
        
        filters = {}
        if role == 'ADMIN':
            filters['admin_id'] = user.id
            
        # Default to last 24 hours for hourly heatmap
        now = timezone.now()
        start_time = now - timezone.timedelta(hours=24)
        
        # 1. Fetch Voters (verified in last 24h)
        # We need operator_id to link to booth
        voters = (
            Voter.objects.filter(verified_at__gte=start_time, **filters)
            .values('operator_id', 'verified_at')
        )
        
        # 2. Get Operator -> Booth Mapping
        operator_ids = set(v['operator_id'] for v in voters if v['operator_id'])
        operators = Operator.objects.filter(id__in=operator_ids).values('id', 'booth_id')
        op_to_booth = {str(op['id']): op['booth_id'] for op in operators}
        
        # 3. Aggregate Data in Python
        # Map: (booth_id, hour_0_23) -> count
        heatmap_counts = {}
        all_booths = set()
        
        for v in voters:
            op_id = str(v['operator_id']) if v['operator_id'] else None
            booth_id = op_to_booth.get(op_id, 'Unknown')
            
            # Get Hour (0-23)
            # verified_at is datetime
            if v['verified_at']:
                 # Ensure timezone awareness if needed, usually Django returns aware dt
                 dt = v['verified_at'].astimezone(timezone.get_current_timezone())
                 hour = dt.hour
                 
                 key = (booth_id, hour)
                 heatmap_counts[key] = heatmap_counts.get(key, 0) + 1
                 all_booths.add(booth_id)

        # 4. Format for Frontend
        data = []
        for (booth, hour), count in heatmap_counts.items():
            data.append({
                'booth': booth,
                'hour': hour,
                'time_label': f"{hour:02d}:00",
                'count': count
            })
            
        # 5. Top Active Booths Filter
        booth_totals = {}
        for d in data:
            bid = d['booth']
            booth_totals[bid] = booth_totals.get(bid, 0) + d['count']
            
        # Sort top 8
        top_booths = sorted(booth_totals.items(), key=lambda x: x[1], reverse=True)[:8]
        top_booth_ids = [b[0] for b in top_booths]
        
        # Filter data
        filtered_data = [d for d in data if d['booth'] in top_booth_ids]
        
        return Response({
            'data': filtered_data,
            'booths': top_booth_ids 
        })
    except Exception as e:
        logger.error(f"Heatmap error: {e}")
        return Response({'error': 'Failed to load heatmap'}, status=500)

@api_view(['GET'])
@permission_classes([IsAuthenticated, IsAdmin])
def fraud_analytics(request):
    """Get fraud analytics: Distribution by Type & 7-Day Trend"""
    try:
        user = request.user
        role = getattr(user, 'role', '')
        
        filters = {}
        if role == 'ADMIN':
            filters['admin_id'] = user.id
            
        # 1. Distribution by Type
        # Count frequency of each fraud_type
        type_distribution = (
            FraudLog.objects.filter(**filters)
            .values('fraud_type')
            .annotate(count=Count('id'))
            .order_by('-count')
        )
        
        # 2. 7-Day Trend
        # Group by date
        last_7_days = timezone.now() - timezone.timedelta(days=7)
        trend_data = (
            FraudLog.objects.filter(flagged_at__gte=last_7_days, **filters)
            .annotate(date=TruncDay('flagged_at'))
            .values('date')
            .annotate(count=Count('id'))
            .order_by('date')
        )
        
        # Format Trend Data (Fill gaps)
        trend_map = {entry['date'].strftime('%Y-%m-%d'): entry['count'] for entry in trend_data if entry['date']}
        formatted_trend = []
        
        for i in range(7):
            d = (timezone.now() - timezone.timedelta(days=6-i)).date() # today + prev 6 days
            key = d.strftime('%Y-%m-%d')
            formatted_trend.append({
                'date': key,
                'count': trend_map.get(key, 0)
            })

        return Response({
            'distribution': type_distribution,
            'trend': formatted_trend
        })
    except Exception as e:
        logger.error(f"Fraud Analytics error: {e}")
        return Response({'error': 'Failed to load analytics'}, status=500)