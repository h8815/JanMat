from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from . import views
from fraud import views as fraud_views

urlpatterns = [
    # Authentication endpoints
    path('admin/login/', views.admin_login, name='admin_login'),
    path('operator/login/', views.operator_login, name='operator_login'),
    path('operator/change-password/', views.change_password, name='change_password'),
    path('current-user/', views.current_user, name='current_user'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    
    # Admin-only endpoints
    path('admin/change-password/', views.admin_change_password, name='admin_change_password'),
    path('admin/update-profile/', views.update_admin_profile, name='update_admin_profile'),
    path('admin/create-operator/', views.create_operator, name='create_operator'),
    path('admin/operators/', views.list_operators, name='list_operators'),
    path('admin/operators/<uuid:pk>/', views.manage_operator, name='manage_operator'),
    path('admin/stats/', views.admin_stats, name='admin_stats'),
    path('admin/fraud-logs/', fraud_views.fraud_logs, name='fraud_logs'),
    
    # NEW: Detail view mapped here to match frontend expectation
    path('admin/fraud-logs/<uuid:log_id>/', fraud_views.fraud_log_detail, name='fraud_log_detail'),
    path('admin/notifications/unread-count/', fraud_views.unread_fraud_count, name='unread_fraud_count'),
    path('admin/notifications/mark-all-reviewed/', fraud_views.mark_all_reviewed, name='mark_all_reviewed'),
    
    path('admin/audit-logs/', views.audit_logs, name='audit_logs'),
    path('admin/voter-stats-chart/', views.voter_stats_chart, name='voter_stats_chart'),
    path('admin/export-report/', views.export_admin_report, name='export_admin_report'),
    
    # Health check
    path('health/', views.health_check, name='auth_health_check'),
]