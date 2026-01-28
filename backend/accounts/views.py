from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken
from django.utils import timezone
from django.db import transaction
from django.db.models import Count, Q
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
        return Response({'error': 'Invalid data', 'details': serializer.errors}, status=400)
    
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
        return Response({'error': 'Invalid data', 'details': serializer.errors}, status=400)
    
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
    """List operators for current admin"""
    try:
        user = request.user
        role = getattr(user, 'role', '')
        
        if role == 'ADMIN':
            operators = Operator.objects.filter(created_by=user)
        elif role == 'SUPERUSER':
             # Superuser sees all
            operators = Operator.objects.all()
        else:
            return Response([])
            
        return Response([OperatorSerializer(op).data for op in operators])
        return Response([OperatorSerializer(op).data for op in operators])
    except Exception as e:
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
        return Response({'error': 'Invalid data', 'details': serializer.errors}, status=400)
        
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
            'Total This Registered Voters': Voter.objects.filter(**filters).count(),
            'Verified Voters': Voter.objects.filter(verified_at__isnull=False, **filters).count(),
            'Fraud Alerts': FraudLog.objects.filter(**fraud_filters).count(),
        }

        operators = Operator.objects.filter(**op_filters).values_list('name', 'email', 'booth_id', 'is_active')
        operator_data = [['Name', 'Email', 'Booth ID', 'Status']] + [
            [op[0], op[1], op[2], 'Active' if op[3] else 'Inactive'] for op in operators
        ]

        fraud_logs = FraudLog.objects.filter(**fraud_filters).order_by('-flagged_at')[:50].values_list(
            'flagged_at', 'fraud_type', 'booth_number'
        )
        fraud_data = [['Time', 'Type', 'Booth']] + [
            [log[0].strftime("%Y-%m-%d %H:%M"), log[1], log[2]] for log in fraud_logs
        ]

        # 2. Generate PDF
        response = HttpResponse(content_type='application/pdf')
        response['Content-Disposition'] = f'attachment; filename="admin_report_{timezone.now().date()}.pdf"'

        doc = SimpleDocTemplate(response, pagesize=letter)
        elements = []
        styles = getSampleStyleSheet()

        # Title
        elements.append(Paragraph(f"JanMat Admin Report - {timezone.now().date()}", styles['Title']))
        elements.append(Paragraph(f"Generated by: {user.email}", styles['Normal']))
        elements.append(Spacer(1, 12))

        # Stats Table
        elements.append(Paragraph("Key Statistics", styles['Heading2']))
        stats_data = [[k, str(v)] for k, v in stats.items()]
        t_stats = Table(stats_data, colWidths=[200, 100])
        t_stats.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (0, -1), colors.lightgrey),
            ('GRID', (0, 0), (-1, -1), 1, colors.black),
        ]))
        elements.append(t_stats)
        elements.append(Spacer(1, 20))

        # Operators Table
        elements.append(Paragraph("Operators List", styles['Heading2']))
        if len(operator_data) > 1:
            t_ops = Table(operator_data)
            t_ops.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                ('GRID', (0, 0), (-1, -1), 1, colors.black),
            ]))
            elements.append(t_ops)
        else:
            elements.append(Paragraph("No operators found.", styles['Normal']))
        elements.append(Spacer(1, 20))

        # Fraud Logs Table
        elements.append(Paragraph("Recent Fraud Alerts (Last 50)", styles['Heading2']))
        if len(fraud_data) > 1:
            t_fraud = Table(fraud_data)
            t_fraud.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.red),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                ('GRID', (0, 0), (-1, -1), 1, colors.black),
            ]))
            elements.append(t_fraud)
        else:
            elements.append(Paragraph("No fraud alerts found.", styles['Normal']))
        elements.append(Spacer(1, 20))

        # Audit Logs Table
        # Fetch audit logs manually here to avoid circular imports or complex logic
        audit_qs = AuditLog.objects.filter(admin_id=user.id) if role == 'ADMIN' else AuditLog.objects.all()
        audit_logs = audit_qs.order_by('-created_at')[:50].values_list('created_at', 'action', 'user_type', 'ip_address')
        
        audit_data = [['Time', 'Action', 'User', 'IP']] + [
            [log[0].strftime("%Y-%m-%d %H:%M"), log[1], log[2], log[3]] for log in audit_logs
        ]
        
        elements.append(Paragraph("Recent Audit Logs (Last 50)", styles['Heading2']))
        if len(audit_data) > 1:
            t_audit = Table(audit_data)
            t_audit.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.navy),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                ('GRID', (0, 0), (-1, -1), 1, colors.black),
            ]))
            elements.append(t_audit)
        else:
             elements.append(Paragraph("No audit logs found.", styles['Normal']))

        doc.build(elements)
        return response

    except Exception as e:
        logger.error(f"Export error: {e}")
        return Response({'error': 'Failed to generate report'}, status=500)

@api_view(['GET'])
@permission_classes([IsAuthenticated, IsAdmin])
def audit_logs(request):
    """Get audit logs"""
    try:
        user = request.user
        role = getattr(user, 'role', '')
        
        if role == 'ADMIN':
            logs = AuditLog.objects.filter(admin_id=user.id)
        else:
            # Superuser
            logs = AuditLog.objects.all()
            
        logs = logs.order_by('-created_at')[:100]
        
        data = []
        for log in logs:
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
        return Response(data)
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
             trunc_func = "DATE_TRUNC('day', verified_at)"
             date_format = '%Y-%m-%d'
             iterations = 7
             iter_delta = timezone.timedelta(days=1)
             iter_start_adjust = timezone.timedelta(days=6) # start from 6 days ago
        elif period == '30d':
             start_time = now - timezone.timedelta(days=30)
             trunc_func = "DATE_TRUNC('day', verified_at)"
             date_format = '%Y-%m-%d'
             iterations = 30
             iter_delta = timezone.timedelta(days=1)
             iter_start_adjust = timezone.timedelta(days=29)
        else: # 24h
             start_time = now - timezone.timedelta(hours=24)
             trunc_func = "DATE_TRUNC('hour', verified_at)"
             date_format = '%H:00'
             iterations = 24
             iter_delta = timezone.timedelta(hours=1)
             iter_start_adjust = timezone.timedelta(hours=23)
        
        # Query
        stats = (
            Voter.objects.filter(verified_at__gte=start_time, **filters)
            .extra({'period_group': trunc_func})
            .values('period_group')
            .annotate(count=Count('id'))
            .order_by('period_group')
        )
        
        data_map = {}
        for stat in stats:
             if stat['period_group']:
                 key = stat['period_group'].strftime(date_format)
                 data_map[key] = stat['count']

        # Fill gaps and build simple arrays
        labels = []
        data = []
        
        # We want to iterate from (now - iter_start_adjust) to now
        current_step = now - iter_start_adjust
        # Align step to hour or day start? 
        # Simplified: Just rely on loop count and formatting.
        # But this is tricky with timezones. Let's do a simple approach.
        
        for i in range(iterations + 1):
             # This loop is rough, better to iterate by delta
             ts = now - (iter_delta * (iterations - i))
             key = ts.strftime(date_format)
             labels.append(key)
             data.append(data_map.get(key, 0))
            
        return Response({
            'labels': labels,
            'data': data
        })
    except Exception as e:
        logger.error(f"Chart stats error: {e}")
        return Response({'error': 'Failed to load chart data'}, status=500)