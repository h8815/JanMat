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
from django.http import HttpResponse
import logging
import string
import secrets
from django.core.mail import send_mail
from django.conf import settings

def generate_temp_password(length=12):
    alphabet = string.ascii_letters + string.digits + "!@#$%^&*"
    while True:
        pwd = ''.join(secrets.choice(alphabet) for i in range(length))
        if (any(c.islower() for c in pwd) and 
            any(c.isupper() for c in pwd) and 
            any(c.isdigit() for c in pwd) and 
            any(c in "!@#$%^&*" for c in pwd)):
            return pwd

try:
    from reportlab.lib.pagesizes import letter
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
    from reportlab.lib.styles import getSampleStyleSheet
    from reportlab.lib import colors
except ImportError:
    pass

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
        username_or_email = request.data.get('username') or request.data.get('email')
        password = request.data.get('password')
        
        if not username_or_email or not password:
            return Response({'error': 'Username/Email and password required'}, status=400)
        
        user = None
        role = None

        # 1. Try SuperAdmin
        try:
            sa = SuperAdmin.objects.get(Q(email__iexact=username_or_email) | Q(username__iexact=username_or_email))
            if check_password(password, sa.password):
                user = sa
                role = 'SUPERUSER'
        except SuperAdmin.DoesNotExist:
            pass

        # 2. Try Admin if not found
        if not user:
            try:
                ad = Admin.objects.get(Q(email__iexact=username_or_email) | Q(username__iexact=username_or_email))
                if check_password(password, ad.password):
                    user = ad
                    role = 'ADMIN'
            except Admin.DoesNotExist:
                pass

        if not user:
            logger.warning(f"Login failed: Invalid credentials for {username_or_email}")
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

        response_data = {
            'access': tokens['access'],
            'refresh': tokens['refresh'],
            'role': role,
            'user': user_data
        }

        # Check for forced password change on first login
        if hasattr(user, 'must_change_password') and user.must_change_password:
            response_data['must_change_password'] = True

        return Response(response_data)
        
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
    
    username_or_email = serializer.validated_data.get('username') or serializer.validated_data.get('email')
    password = serializer.validated_data['password']
    
    try:
        user = Operator.objects.select_related('created_by').get(Q(email__iexact=username_or_email) | Q(username__iexact=username_or_email))
        
        if not check_password(password, user.password):
            return Response({'error': 'Invalid credentials'}, status=401)
            
        if not user.is_active:
             return Response({'error': 'Account is disabled'}, status=403)
        
        # Ensure operator has admin (tenant isolation)
        if not user.created_by:
            logger.error(f"Operator {username_or_email} has no admin assigned")
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
            temp_password = generate_temp_password()
            operator = Operator.objects.create(
                username=serializer.validated_data['username'],
                email=serializer.validated_data['email'],
                password=make_password(temp_password),
                name=serializer.validated_data.get('full_name', ''),
                booth_id=serializer.validated_data['booth_id'],
                created_by=admin_ref,
                must_change_password=True,
                is_active=True
            )
            
            # Dispatch Welcome Email
            try:
                subject = "Your JanMat Operator Account Credentials"
                message = f"Welcome {operator.name or 'Operator'}!\n\nYour account has been successfully provisioned for Booth {operator.booth_id}.\n\nYour login details are:\nUsername: {operator.username}\nTemporary Password: {temp_password}\n\nPlease login to the portal. You will be required to change your password immediately upon your first login for security reasons."
                send_mail(
                    subject,
                    message,
                    settings.EMAIL_HOST_USER,
                    [operator.email],
                    fail_silently=False,
                )
            except Exception as mail_err:
                logger.error(f"Failed to send welcome email to {operator.email}: {mail_err}")
        
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

@api_view(['POST'])
@permission_classes([AllowAny])
def setup_initial_password(request):
    """Endpoint for Operators/Admins to set their password on their first login"""
    username = request.data.get('username')
    temp_password = request.data.get('temp_password')
    new_password = request.data.get('new_password')
    
    if not all([username, temp_password, new_password]):
        return Response({'error': 'Missing required fields'}, status=400)
        
    try:
        from django.contrib.auth.password_validation import validate_password
        validate_password(new_password)
    except Exception as e:
        return Response({'error': str(e)}, status=400)

    user = None
    role = None
    
    # Check Admin
    try:
        ad = Admin.objects.get(Q(username__iexact=username) | Q(email__iexact=username))
        if check_password(temp_password, ad.password):
            user = ad
            role = 'ADMIN'
    except Admin.DoesNotExist:
        pass
        
    # Check Operator
    if not user:
        try:
            op = Operator.objects.get(Q(username__iexact=username) | Q(email__iexact=username))
            if check_password(temp_password, op.password):
                user = op
                role = 'OPERATOR'
        except Operator.DoesNotExist:
            pass
            
    if not user:
        return Response({'error': 'Invalid credentials'}, status=401)
        
    if not getattr(user, 'must_change_password', False):
        return Response({'error': 'Account does not require a password change'}, status=400)
        
    # Update Password
    user.password = make_password(new_password)
    user.must_change_password = False
    
    # Update last login
    user.last_login = timezone.now()
    user.save()
    
    # Audit log
    if role == 'OPERATOR' and user.created_by:
        AuditService.log_action(
            action='initial_password_set',
            user_type='operator',
            user_id=user.id,
            admin_id=user.created_by.id,
            ip_address=request.META.get('REMOTE_ADDR')
        )
        
    # Generate fresh tokens
    tokens = get_tokens_for_user(user, role)
    
    if role == 'ADMIN':
        user_data = AdminSerializer(user).data
        response_data = {
            'access': tokens['access'],
            'refresh': tokens['refresh'],
            'role': role,
            'user': user_data
        }
    else:
        user_data = OperatorSerializer(user).data
        response_data = {
            'access': tokens['access'],
            'refresh': tokens['refresh'],
            'role': role,
            'user': user_data,
            'admin_id': str(user.created_by.id) if user.created_by else None
        }
        
    return Response(response_data)

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
def toggle_operator_status(request, pk):
    """
    Dedicated endpoint to activate/deactivate an individual operator.
    Operates on the correct Operator.is_active field — NOT Django auth.
    """
    try:
        user = request.user
        role = getattr(user, 'role', '')

        if role == 'SUPERUSER':
            operator = Operator.objects.get(pk=pk)
        elif role == 'ADMIN':
            operator = Operator.objects.get(pk=pk, created_by=user)
        else:
            return Response({'error': 'Unauthorized'}, status=403)

        # Flip is_active
        operator.is_active = not operator.is_active
        operator.save(update_fields=['is_active'])

        action = 'operator_activated' if operator.is_active else 'operator_deactivated'
        try:
            AuditService.log_action(
                action=action,
                user_type='admin',
                user_id=user.id,
                admin_id=user.id if role == 'ADMIN' else None,
                resource_type='operator',
                resource_id=operator.id,
                details={'new_status': operator.is_active},
                ip_address=request.META.get('REMOTE_ADDR')
            )
        except Exception as audit_err:
            logger.warning(f"Audit log failed: {audit_err}")

        return Response({
            'success': True,
            'is_active': operator.is_active,
            'message': f"Operator {'activated' if operator.is_active else 'deactivated'} successfully"
        })

    except Operator.DoesNotExist:
        return Response({'error': 'Operator not found'}, status=404)
    except Exception as e:
        logger.error(f"Toggle status error: {e}")
        return Response({'error': 'Failed to toggle status'}, status=500)

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
        
        # Read query params for export customization
        start_date = request.GET.get('start_date', '').strip()
        end_date   = request.GET.get('end_date', '').strip()
        report_type = request.GET.get('report_type', 'full').strip().lower()
        limit      = min(int(request.GET.get('limit', 10000)), 50000)

        # 1. Base Filters
        filters = {}
        if role == 'ADMIN':
            filters['admin_id'] = user.id
            op_filters = {'created_by': user}
            fraud_filters = {'admin': user}
            audit_filters = {'admin_id': user.id}
        else:
            op_filters = {}
            fraud_filters = {}
            audit_filters = {}

        # Apply date filters
        if start_date:
            fraud_filters['flagged_at__date__gte'] = start_date
            audit_filters['created_at__date__gte'] = start_date
        if end_date:
            fraud_filters['flagged_at__date__lte'] = end_date
            audit_filters['created_at__date__lte'] = end_date

        # PDF Labels
        t = {
            'title': 'JanMat Admin Report',
            'date': 'Date',
            'gen_by': 'Generated by',
            'stats': 'Key Statistics',
            'ops_list': 'Operators List',
            'fraud_logs': f'Recent Fraud Alerts (Limit: {limit})',
            'audit_logs': f'Recent Audit Logs (Limit: {limit})',
            'no_ops': 'No operators found.',
            'no_fraud': 'No fraud alerts found.',
            'no_audit': 'No audit logs found.',
            'col_time': 'Time', 'col_type': 'Type', 'col_booth': 'Booth', 'col_op': 'Operator', 'col_admin': 'Admin',
            'col_name': 'Name', 'col_email': 'Email', 'col_status': 'Status',
            'col_action': 'Action', 'col_role': 'Role', 'col_user': 'Username', 'col_ip': 'IP',
            'active': 'Active', 'inactive': 'Inactive',
            'status_verified': 'Verified Voters',
            'status_fraud': 'Fraud Alerts',
            'status_total_op': 'Total Operators',
            'status_total_voter': 'Total Registered Voters'
        }

        # Data collection based on report_type
        stats = {}
        if report_type in ['full', 'verifications', 'operators']:
            stats[t['status_total_op']] = Operator.objects.filter(**op_filters).count()
            stats[t['status_total_voter']] = Voter.objects.filter(**filters).count()
            stats[t['status_verified']] = Voter.objects.filter(verified_at__isnull=False, **filters).count()
        if report_type in ['full', 'fraud']:
            stats[t['status_fraud']] = FraudLog.objects.filter(**fraud_filters).count()

        # Operators Data
        operator_data = []
        if report_type in ['full', 'operators']:
            ops = Operator.objects.filter(**op_filters).values_list('name', 'email', 'booth_id', 'is_active')
            operator_data = [[t['col_name'], t['col_email'], t['col_booth'], t['col_status']]] + [
                [op[0], op[1], op[2], t['active'] if op[3] else t['inactive']] for op in ops
            ]

        # Fraud Data
        fraud_data = []
        if report_type in ['full', 'fraud']:
            fraud_logs = FraudLog.objects.filter(**fraud_filters).select_related('operator', 'admin').order_by('-flagged_at')[:limit]
            fraud_data = [[t['col_time'], t['col_type'], t['col_booth'], t['col_op'], t['col_admin']]]
            for log in fraud_logs:
                op_name = log.operator.name if log.operator else 'Unknown'
                if log.operator and not op_name: op_name = log.operator.email
                admin_name = log.admin.name if log.admin else 'System'
                fraud_data.append([
                    log.flagged_at.strftime("%Y-%m-%d %H:%M"),
                    log.fraud_type.replace('_', ' ').title(),
                    log.booth_number,
                    op_name,
                    admin_name
                ])

        # Audit Data
        audit_table_data = []
        if report_type in ['full', 'audit']:
            audit_qs = AuditLog.objects.filter(**audit_filters).order_by('-created_at')[:limit]
            
            admin_map = {str(a.id): a.name for a in Admin.objects.all()}
            op_map = {str(o.id): o.name or o.full_name for o in Operator.objects.all()}
            
            audit_table_data = [[t['col_time'], t['col_action'], t['col_role'], t['col_user'], t['col_ip']]]
            for log in audit_qs:
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

        # 2. Generate PDF
        response = HttpResponse(content_type='application/pdf')
        filename_prefix = "admin_report"
        if report_type != "full":
            filename_prefix = f"admin_{report_type}_report"
        response['Content-Disposition'] = f'attachment; filename="{filename_prefix}_{timezone.now().date()}.pdf"'

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
        elements.append(Paragraph(t['title'], title_style))
        date_str = timezone.now().date().strftime("%Y-%m-%d")
        if start_date or end_date:
            date_str = f"{start_date or 'Beginning'} to {end_date or 'Now'}"
        elements.append(Paragraph(f"{t['date']}: {date_str}", styles['Normal']))
        admin_name = getattr(user, 'name', getattr(user, 'full_name', 'System Admin'))
        elements.append(Paragraph(f"{t['gen_by']}: {user.email} | {admin_name}", styles['Normal']))
        elements.append(Spacer(1, 20))

        # Stats Table
        if stats:
            elements.append(Paragraph(t['stats'], heading_style))
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
            
        # Operators Table
        if report_type in ['full', 'operators']:
            elements.append(Paragraph(t['ops_list'], heading_style))
            if len(operator_data) > 1:
                t_ops = Table(operator_data, repeatRows=1, colWidths=[120, 180, 100, 80], hAlign='LEFT')
                t_ops.setStyle(TableStyle([
                    ('BACKGROUND', (0, 0), (-1, 0), HEADER_BG),
                    ('TEXTCOLOR', (0, 0), (-1, 0), HEADER_TEXT),
                    ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                    ('FONTSIZE', (0, 0), (-1, 0), 10),
                    ('TOPPADDING', (0, 0), (-1, 0), 8),
                    ('BOTTOMPADDING', (0, 0), (-1, 0), 8),
                    ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
                    ('FONTSIZE', (0, 1), (-1, -1), 9),
                    ('TOPPADDING', (0, 1), (-1, -1), 6),
                    ('BOTTOMPADDING', (0, 1), (-1, -1), 6),
                    ('TEXTCOLOR', (0, 1), (-1, -1), colors.black),
                    ('ROWBACKGROUNDS', (0, 1), (-1, -1), [ROW_BG, ROW_WHITE]),
                    ('GRID', (0, 0), (-1, -1), 0.5, colors.lightgrey),
                ]))
                elements.append(t_ops)
            else:
                elements.append(Paragraph(t['no_ops'], styles['Normal']))

        # Fraud Logs Table
        if report_type in ['full', 'fraud']:
            elements.append(Paragraph(t['fraud_logs'], heading_style))
            if len(fraud_data) > 1:
                t_fraud = Table(fraud_data, repeatRows=1, colWidths=[90, 110, 80, 120, 100], hAlign='LEFT')
                t_fraud.setStyle(TableStyle([
                    ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#DC2626')),
                    ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
                    ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                    ('FONTSIZE', (0, 0), (-1, 0), 9),
                    ('TOPPADDING', (0, 0), (-1, 0), 8),
                    ('BOTTOMPADDING', (0, 0), (-1, 0), 8),
                    ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
                    ('FONTSIZE', (0, 1), (-1, -1), 8),
                    ('TOPPADDING', (0, 1), (-1, -1), 6),
                    ('BOTTOMPADDING', (0, 1), (-1, -1), 6),
                    ('TEXTCOLOR', (0, 1), (-1, -1), colors.black),
                    ('ROWBACKGROUNDS', (0, 1), (-1, -1), [ROW_BG, ROW_WHITE]),
                    ('GRID', (0, 0), (-1, -1), 0.5, colors.lightgrey),
                ]))
                elements.append(t_fraud)
            else:
                elements.append(Paragraph(t['no_fraud'], styles['Normal']))

        # Audit Logs Table
        if report_type in ['full', 'audit']:
            elements.append(Paragraph(t['audit_logs'], heading_style))
            if len(audit_table_data) > 1:
                t_audit = Table(audit_table_data, repeatRows=1, colWidths=[90, 100, 70, 120, 100], hAlign='LEFT')
                t_audit.setStyle(TableStyle([
                    ('BACKGROUND', (0, 0), (-1, 0), JANMAT_BLUE),
                    ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
                    ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                    ('FONTSIZE', (0, 0), (-1, 0), 9),
                    ('TOPPADDING', (0, 0), (-1, 0), 8),
                    ('BOTTOMPADDING', (0, 0), (-1, 0), 8),
                    ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
                    ('FONTSIZE', (0, 1), (-1, -1), 8),
                    ('TOPPADDING', (0, 1), (-1, -1), 6),
                    ('BOTTOMPADDING', (0, 1), (-1, -1), 6),
                    ('TEXTCOLOR', (0, 1), (-1, -1), colors.black),
                    ('ROWBACKGROUNDS', (0, 1), (-1, -1), [ROW_BG, ROW_WHITE]),
                    ('GRID', (0, 0), (-1, -1), 0.5, colors.lightgrey),
                ]))
                elements.append(t_audit)
            else:
                 elements.append(Paragraph(t['no_audit'], styles['Normal']))

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
def voter_stats_chart(request):
    """
    Get aggregated voter verification and fraud stats for charts
    Period: '24h', '7d', '30d'
    """
    try:
        period = request.GET.get('period', '24h')
        now = timezone.now()
        
        if period == '24h':
            start_time = now - timezone.timedelta(hours=24)
            trunc_func = TruncHour('created_at')
            trunc_func_fraud = TruncHour('flagged_at')
            date_format = '%H:00'
            all_points = [(start_time + timezone.timedelta(hours=i)).strftime(date_format) for i in range(25)]
        elif period == '7d':
            start_time = now - timezone.timedelta(days=7)
            trunc_func = TruncDay('created_at')
            trunc_func_fraud = TruncDay('flagged_at')
            date_format = '%Y-%m-%d'
            all_points = [(start_time + timezone.timedelta(days=i)).strftime(date_format) for i in range(8)]
        else: # 30d
            start_time = now - timezone.timedelta(days=30)
            trunc_func = TruncDay('created_at')
            trunc_func_fraud = TruncDay('flagged_at')
            date_format = '%Y-%m-%d'
            all_points = [(start_time + timezone.timedelta(days=i)).strftime(date_format) for i in range(31)]

        # 1. Verified Voters Scans
        voters = Voter.objects.filter(created_at__gte=start_time)\
            .annotate(period=trunc_func)\
            .values('period')\
            .annotate(count=Count('id'))\
            .order_by('period')

        # 2. Fraud Alerts
        fraud = FraudLog.objects.filter(flagged_at__gte=start_time)\
            .annotate(period=trunc_func_fraud)\
            .values('period')\
            .annotate(count=Count('id'))\
            .order_by('period')

        # Map to labels
        data_map = {item['period'].strftime(date_format): item['count'] for item in voters}
        fraud_map = {item['period'].strftime(date_format): item['count'] for item in fraud}

        final_voters = [data_map.get(label, 0) for label in all_points]
        final_fraud = [fraud_map.get(label, 0) for label in all_points]

        return Response({
            'labels': all_points,
            'data': final_voters,
            'fraud_data': final_fraud
        })
    except Exception as e:
        logger.error(f"Chart error: {e}")
        return Response({'labels': [], 'data': [], 'fraud_data': []})



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
        elif role == 'SUPERUSER':
            queryset = AuditLog.objects.all()
        else:
             queryset = AuditLog.objects.none()
             
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
            # Resolve user name from user_id
            user_name = None
            if log.user_id:
                try:
                    if log.user_type == 'operator':
                        op = Operator.objects.filter(id=log.user_id).first()
                        if op:
                            user_name = op.name
                    elif log.user_type == 'admin':
                        adm = Admin.objects.filter(id=log.user_id).first()
                        if adm:
                            user_name = adm.name
                except Exception:
                    pass
            
            data.append({
                'id': str(log.id),
                'action': log.action,
                'user_type': log.user_type,
                'user_id': str(log.user_id) if log.user_id else None,
                'user_name': user_name,
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
@permission_classes([IsAuthenticated])
def operator_stats(request):
    """Get stats for operator dashboard"""
    user = request.user
    role = getattr(user, 'role', '')
    
    if role != 'OPERATOR':
        return Response({'error': 'Unauthorized'}, status=403)
        
    try:
        now = timezone.now()
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        
        # 1. Verification Stats
        today_verifications = Voter.objects.filter(operator_id=user.id, verified_at__gte=today_start).count()
        total_verifications = Voter.objects.filter(operator_id=user.id).count()
        
        # 2. Fraud Stats
        fraud_qs = FraudLog.objects.filter(operator_id=user.id)
        fraud_alerts_today = fraud_qs.filter(flagged_at__gte=today_start).count()
        pending_fraud_alerts = fraud_qs.filter(reviewed=False).count()
        
        # 3. Recent Verifications (last 5 today)
        recent_voters = Voter.objects.filter(
            operator_id=user.id,
            verified_at__gte=today_start
        ).order_by('-verified_at')[:5]
        
        recent_list = []
        for v in recent_voters:
            recent_list.append({
                'name': v.full_name,
                'aadhaar_masked': f"XXXX-{v.aadhaar_number[-4:]}" if v.aadhaar_number else '',
                'time': v.verified_at.strftime('%H:%M') if v.verified_at else '',
            })
        
        return Response({
            'today_verifications': today_verifications,
            'total_verifications': total_verifications,
            'fraud_alerts_today': fraud_alerts_today,
            'pending_fraud_alerts': pending_fraud_alerts,
            'booth_id': user.booth_id,
            'recent_verifications': recent_list,
        })
    except Exception as e:
        logger.error(f"Operator stats error: {e}")
        return Response({'error': 'Failed to load stats'}, status=500)
