from accounts.constants import SystemRoles
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import InvalidToken, AuthenticationFailed
from django.contrib.auth.backends import ModelBackend
from django.contrib.auth import get_user_model
from django.contrib.auth.hashers import check_password
from .models import SuperAdmin, Admin, Operator

class JanmatTokenAuthentication(JWTAuthentication):
    """
    Custom Authentication backend to support multiple user tables (SuperAdmin, Admin, Operator).
    Reads 'role' and 'user_id' from JWT payload to fetch the correct model instance.
    """
    
    def get_user(self, validated_token):
        """
        Attempts to find and return a user using the given validated token.
        """
        try:
            user_id = validated_token['user_id']
            role = validated_token.get('role', '').upper()
        except KeyError:
            raise InvalidToken('Token contained no recognizable user identification')

        user = None
        
        try:
            if role == SystemRoles.SUPERUSER:
                user = SuperAdmin.objects.get(id=user_id)
            elif role == SystemRoles.ADMIN:
                user = Admin.objects.get(id=user_id)
            elif role == SystemRoles.OPERATOR:
                user = Operator.objects.get(id=user_id)
            else:
                # Fallback: try one by one if role is missing (legacy)
                if not user:
                    try: user = SuperAdmin.objects.get(id=user_id); role=SystemRoles.SUPERUSER
                    except SuperAdmin.DoesNotExist: pass
                if not user:
                    try: user = Admin.objects.get(id=user_id); role=SystemRoles.ADMIN
                    except Admin.DoesNotExist: pass
                if not user:
                    try: user = Operator.objects.get(id=user_id); role=SystemRoles.OPERATOR
                    except Operator.DoesNotExist: pass
            
            if not user:
                raise AuthenticationFailed('User not found', code='user_not_found')
                
            if not user.is_active:
                raise AuthenticationFailed('User is inactive', code='user_inactive')

            # Attach role attribute dynamically for permissions
            user.role = role
            return user

        except (SuperAdmin.DoesNotExist, Admin.DoesNotExist, Operator.DoesNotExist):
            raise AuthenticationFailed('User not found', code='user_not_found')

class JanmatModelBackend(ModelBackend):
    """
    Custom Backend for Django Admin Login.
    Authenticates against SuperAdmin table but returns a proxy JanmatAuthUser.
    """
    def authenticate(self, request, username=None, password=None, **kwargs):
        if username is None:
            username = kwargs.get('email')
        
        try:
            # Check SuperAdmin table
            super_admin = SuperAdmin.objects.get(username__iexact=username)
            if check_password(password, super_admin.password) and super_admin.is_active:
                # Found valid SuperAdmin. Now get/create bridging JanmatAuthUser using their real email
                User = get_user_model()
                auth_user, created = User.objects.get_or_create(email=super_admin.email)
                
                # Sync permissions
                if not auth_user.is_staff or not auth_user.is_superuser:
                    auth_user.is_staff = True
                    auth_user.is_superuser = True
                    auth_user.is_active = True
                    # We don't set password on auth_user, we trust SuperAdmin password
                    auth_user.save()
                
                # Attach real SuperAdmin object for admin.py use
                auth_user.super_admin_profile = super_admin 
                return auth_user
                
        except SuperAdmin.DoesNotExist:
            return None
        
        return None

    def get_user(self, user_id):
        User = get_user_model()
        try:
            user = User.objects.get(pk=user_id)
            # Re-attach profile if needed (though session usually serializes only user)
            # We might need middleware to attach profile on every request if we need it in admin.
            try:
                user.super_admin_profile = SuperAdmin.objects.get(email=user.email)
            except SuperAdmin.DoesNotExist:
                pass
            return user
        except User.DoesNotExist:
            return None