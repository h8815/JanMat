from django.contrib import admin
from django.urls import path, include
from .health import health_check

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/health/', health_check, name='health_check'),
    path('api/auth/', include('accounts.urls')),
    path('api/verification/', include('verification.urls')),
    path('api/fraud/', include('fraud.urls')),
]