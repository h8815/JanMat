from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from . import views

urlpatterns = [
    # Authentication endpoints
    path('admin/login/', views.admin_login, name='admin_login'),
    path('operator/login/', views.operator_login, name='operator_login'),
    path('operator/change-password/', views.change_password, name='change_password'),
    path('current-user/', views.current_user, name='current_user'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    
    # Admin-only endpoints
    path('admin/change-password/', views.admin_change_password, name='admin_change_password'),
    path('admin/create-operator/', views.create_operator, name='create_operator'),
    path('admin/operators/', views.list_operators, name='list_operators'),
    path('admin/operators/<uuid:pk>/', views.manage_operator, name='manage_operator'),
    path('admin/stats/', views.admin_stats, name='admin_stats'),
    path('admin/fraud-logs/', views.fraud_logs, name='fraud_logs'),
    path('admin/audit-logs/', views.audit_logs, name='audit_logs'),
    path('admin/voter-stats-chart/', views.voter_stats_chart, name='voter_stats_chart'),
    path('admin/export-report/', views.export_admin_report, name='export_admin_report'),
    
    # Health check
    path('health/', views.health_check, name='auth_health_check'),
]