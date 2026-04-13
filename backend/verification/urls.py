from django.urls import path
from . import views

urlpatterns = [
    # Operator verification endpoints
    path('send-otp/', views.send_otp, name='send_otp'),
    path('verify-otp/', views.verify_otp, name='verify_otp'),
    path('biometric-scan/', views.biometric_scan, name='biometric_scan'),
    path('current-session/', views.current_session, name='current_session'),
    
    # Health & Public
    path('health/', views.health_check, name='verification_health_check'),
    path('public-stats/', views.public_stats, name='public_stats'),
]