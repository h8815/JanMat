from accounts.constants import SystemRoles
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken
from django.utils import timezone
from django.contrib.auth.hashers import check_password, make_password
from django.db.models import Q
import logging

from ..models import SuperAdmin, Admin, Operator
from ..serializers import (
    AdminLoginSerializer, 
    OperatorLoginSerializer, 
    ChangePasswordSerializer,
    AdminChangePasswordSerializer,
    SuperAdminSerializer,
    AdminSerializer,
    OperatorSerializer
)
from .utils import generate_temp_password
from ..utils import send_mail_async
from verification.services import AuditService

logger = logging.getLogger(__name__)

def get_tokens_for_user(user, role):
    """Generate JWT tokens for user with custom claims"""
    refresh = RefreshToken()
    refresh['user_id'] = str(user.id)
    refresh['email'] = user.email
    refresh['role'] = role
    
    if role == SystemRoles.ADMIN:
        refresh['admin_id'] = str(user.id)
    elif role == SystemRoles.OPERATOR:
        refresh['admin_id'] = str(user.created_by.id) if user.created_by else None
        refresh['booth_id'] = getattr(user, 'booth_id', None)
        refresh['full_name'] = getattr(user, 'name', '')
    
    return {
        'refresh': str(refresh),
        'access': str(refresh.access_token),
    }

def process_successful_login(user, role, request):
    """Helper method to deduplicate login response gathering"""
    if not user.is_active:
        return Response({'error': 'Account is disabled'}, status=status.HTTP_403_FORBIDDEN)
        
    user.last_login = timezone.now()
    user.save(update_fields=['last_login'])
    
    tokens = get_tokens_for_user(user, role)
    
    if role == SystemRoles.SUPERUSER:
        user_data = SuperAdminSerializer(user).data
    elif role == SystemRoles.ADMIN:
        user_data = AdminSerializer(user).data
    else:
        user_data = OperatorSerializer(user).data
        
    # Build response data
    response_data = {
        'access': tokens['access'],
        'refresh': tokens['refresh'],
        'role': role,
        'user': user_data
    }
    
    if role == SystemRoles.OPERATOR and hasattr(user, 'created_by') and user.created_by:
        response_data['admin_id'] = str(user.created_by.id)
        # Log successful operator login since admin logins weren't originally audited in operator_login
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

    if hasattr(user, 'must_change_password') and user.must_change_password:
        response_data['must_change_password'] = True

    return Response(response_data)

@api_view(['POST'])
@permission_classes([AllowAny])
def admin_login(request):
    """Login for SUPERUSER and ADMIN roles"""
    try:
        username = request.data.get('username', '').strip()
        password = request.data.get('password')
        
        if not username or not password:
            return Response({'error': 'Username and password required'}, status=status.HTTP_400_BAD_REQUEST)
        
        user = None
        role = None

        try:
            sa = SuperAdmin.objects.get(username__iexact=username)
            if check_password(password, sa.password):
                user, role = sa, SystemRoles.SUPERUSER
        except SuperAdmin.DoesNotExist:
            pass

        if not user:
            try:
                ad = Admin.objects.get(username__iexact=username)
                if check_password(password, ad.password):
                    user, role = ad, SystemRoles.ADMIN
            except Admin.DoesNotExist:
                pass

        if not user:
            logger.warning(f"Login failed: Invalid credentials for {username}")
            return Response({'error': 'Invalid credentials'}, status=status.HTTP_401_UNAUTHORIZED)
        
        return process_successful_login(user, role, request)
        
    except Exception as e:
        logger.error(f"Login error: {str(e)}")
        return Response({'error': 'Login failed'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['POST'])
@permission_classes([AllowAny])
def operator_login(request):
    """Operator login endpoint"""
    serializer = OperatorLoginSerializer(data=request.data)
    
    if not serializer.is_valid():
        return Response({'error': 'Invalid input', 'details': serializer.errors}, status=status.HTTP_400_BAD_REQUEST)
    
    username = serializer.validated_data.get('username', '').strip()
    password = serializer.validated_data['password']
    
    try:
        user = Operator.objects.select_related('created_by').get(username__iexact=username)
        
        if not check_password(password, user.password):
            return Response({'error': 'Invalid credentials'}, status=status.HTTP_401_UNAUTHORIZED)
            
        if not user.created_by:
            logger.error(f"Operator {username} has no admin assigned")
            return Response({'error': 'Configuration error'}, status=status.HTTP_403_FORBIDDEN)
            
        return process_successful_login(user, SystemRoles.OPERATOR, request)
        
    except Operator.DoesNotExist:
        return Response({'error': 'Invalid credentials'}, status=status.HTTP_401_UNAUTHORIZED)
    except Exception as e:
        logger.error(f"Operator login error: {str(e)}")
        return Response({'error': 'Service unavailable'}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

@api_view(['POST'])
@permission_classes([AllowAny])
def forgot_password(request):
    username = request.data.get('username', '').strip()
    if not username:
        return Response({'error': 'Username is required'}, status=400)
    
    user = Admin.objects.filter(username__iexact=username).first()
    role = 'Admin'
    
    if not user:
        user = Operator.objects.filter(username__iexact=username).first()
        role = 'Operator'
        
    if not user:
        return Response({'success': True, 'message': 'If an account exists, a password reset email has been sent.'})

    temp_pwd = generate_temp_password()
    user.password = make_password(temp_pwd)
    user.must_change_password = True
    user.save()
    
    subject = f'JanMat - {role} Password Reset'
    message = f'''Hello {user.name or role},

A password reset was requested for your JanMat {role} portal account.

Your new login details:
Username: {user.username or user.email}
Temporary Password: {temp_pwd}

Please log in to the portal where you will be prompted to change your password immediately.

If you did not request this reset, please contact your SuperAdmin.

Regards,
JanMat System'''
    try:
        send_mail_async(subject, message, [user.email])
    except Exception as e:
        logger.error(f"Failed to send reset email to {user.email}: {e}")
        
    return Response({'success': True, 'message': 'If an account exists, a password reset email has been sent.'})

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def change_password(request):
    user = request.user
    role = getattr(user, 'role', '') 
    
    if role != SystemRoles.OPERATOR:
        return Response({'error': 'Only operators can change password here'}, status=403)
    
    serializer = ChangePasswordSerializer(data=request.data)
    if not serializer.is_valid():
        return Response({'error': 'Password should be at least 12 characters long', 'details': serializer.errors}, status=400)
    
    try:
        new_password = serializer.validated_data['new_password']
        
        user.password = make_password(new_password)
        user.must_change_password = False
        user.save(update_fields=['password', 'must_change_password'])
        
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
@permission_classes([IsAuthenticated])
def admin_change_password(request):
    user = request.user
    role = getattr(user, 'role', '')
    
    if role not in [SystemRoles.ADMIN, SystemRoles.SUPERUSER]:
        return Response({'error': 'Unauthorized'}, status=403)
        
    serializer = AdminChangePasswordSerializer(data=request.data)
    
    if not serializer.is_valid():
        return Response({'error': 'Validation failed', 'details': serializer.errors}, status=400)
        
    old_password = serializer.validated_data['old_password']
    new_password = serializer.validated_data['new_password']
    
    if not check_password(old_password, user.password):
        return Response({'error': 'Incorrect current password'}, status=400)
        
    user.password = make_password(new_password)
    user.save(update_fields=['password'])
    
    try:
        AuditService.log_action(
            action='password_changed',
            user_type='admin',
            user_id=user.id,
            admin_id=user.id if role == SystemRoles.ADMIN else None,
            ip_address=request.META.get('REMOTE_ADDR')
        )
    except: pass
    
    return Response({'success': True, 'message': 'Password updated successfully'})

@api_view(['POST'])
@permission_classes([AllowAny])
def setup_initial_password(request):
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
    
    try:
        ad = Admin.objects.get(Q(username__iexact=username) | Q(email__iexact=username))
        if check_password(temp_password, ad.password):
            user, role = ad, SystemRoles.ADMIN
    except Admin.DoesNotExist:
        pass
        
    if not user:
        try:
            op = Operator.objects.get(Q(username__iexact=username) | Q(email__iexact=username))
            if check_password(temp_password, op.password):
                user, role = op, SystemRoles.OPERATOR
        except Operator.DoesNotExist:
            pass
            
    if not user:
        return Response({'error': 'Invalid credentials'}, status=401)
        
    if not getattr(user, 'must_change_password', False):
        return Response({'error': 'Account does not require a password change'}, status=400)
        
    user.password = make_password(new_password)
    user.must_change_password = False
    user.save(update_fields=['password', 'must_change_password'])
    
    return process_successful_login(user, role, request)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def current_user(request):
    user = request.user
    role = getattr(user, 'role', 'UNKNOWN')
    
    data = {'role': role}
    
    if role == SystemRoles.SUPERUSER:
        data['user'] = SuperAdminSerializer(user).data
    elif role == SystemRoles.ADMIN:
        data['user'] = AdminSerializer(user).data
        data['admin_id'] = str(user.id)
    elif role == SystemRoles.OPERATOR:
        data['user'] = OperatorSerializer(user).data
        if user.created_by:
            data['admin_id'] = str(user.created_by.id)
            
    return Response(data)
