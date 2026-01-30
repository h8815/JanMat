from django.urls import path
from . import views

urlpatterns = [
    # Fraud monitoring endpoints (admin only)
    path('logs/', views.fraud_logs, name='fraud_logs'),
    path('logs/<uuid:log_id>/', views.fraud_log_detail, name='fraud_log_detail'),
    path('stats/', views.fraud_stats, name='fraud_stats'),
]