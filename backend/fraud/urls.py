from django.urls import path
from . import views

urlpatterns = [
    # Fraud monitoring endpoints (admin only)
    path('logs/', views.fraud_logs, name='fraud_logs'),
    path('stats/', views.fraud_stats, name='fraud_stats'),
]