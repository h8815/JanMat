from django.http import HttpResponseRedirect
from django.urls import reverse


class SuperAdminPasswordChangeMiddleware:
    """
    Forces SuperAdmin users with must_change_password=True to the
    change-password page on every Django admin request.
    Exempts the change-password page itself (and static/media) to avoid redirect loops.
    """

    EXEMPT_PATHS = {
        '/janmat-superadmin/login/',
        '/janmat-superadmin/change-password/',
        '/janmat-superadmin/logout/',
    }

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        path = request.path

        # Only intercept Django admin paths (not API)
        if path.startswith('/janmat-superadmin/') and path not in self.EXEMPT_PATHS:
            user = request.user
            if user.is_authenticated:
                sa = getattr(user, 'super_admin_profile', None)
                if sa is not None and getattr(sa, 'must_change_password', False):
                    return HttpResponseRedirect('/janmat-superadmin/change-password/')

        return self.get_response(request)
