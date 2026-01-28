from rest_framework.permissions import BasePermission

class IsAdmin(BasePermission):
    """
    Allows access to Admins and Superusers.
    """
    
    def has_permission(self, request, view):
        return (
            request.user and 
            request.user.is_authenticated and 
            hasattr(request.user, 'role') and 
            request.user.role in ['ADMIN', 'SUPERUSER']
        )

class IsOperator(BasePermission):
    """
    Allows access to Operators.
    """
    
    def has_permission(self, request, view):
        return (
            request.user and 
            request.user.is_authenticated and 
            hasattr(request.user, 'role') and 
            request.user.role == 'OPERATOR'
        )