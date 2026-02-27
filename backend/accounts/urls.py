from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from fraud import views as fraud_views
from .views import auth, dashboard, operators, utils

urlpatterns = [
    # Authentication endpoints
    path('admin/login/', auth.admin_login, name='admin_login'),
    path('operator/login/', auth.operator_login, name='operator_login'),
    path('operator/stats/', operators.operator_stats, name='operator_stats'),
    path('operator/change-password/', auth.change_password, name='change_password'),
    path('setup-password/', auth.setup_initial_password, name='setup_initial_password'),
    path('forgot-password/', auth.forgot_password, name='forgot_password'),
    path('current-user/', auth.current_user, name='current_user'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    
    # Admin-only endpoints
    path('admin/change-password/', auth.admin_change_password, name='admin_change_password'),
    path('admin/update-profile/', dashboard.update_admin_profile, name='update_admin_profile'),
    path('admin/create-operator/', operators.create_operator, name='create_operator'),
    path('admin/operators/', operators.list_operators, name='list_operators'),
    path('admin/operators/<uuid:pk>/', operators.manage_operator, name='manage_operator'),
    path('admin/operators/<uuid:pk>/toggle/', operators.toggle_operator_status, name='toggle_operator_status'),
    path('admin/operators/<uuid:pk>/send-credentials/', operators.send_operator_credentials, name='send_operator_credentials'),
    path('admin/operators/bulk/', operators.bulk_operator_action, name='bulk_operator_action'),
    path('admin/stats/', dashboard.admin_stats, name='admin_stats'),
    path('admin/fraud-logs/', fraud_views.fraud_logs, name='fraud_logs'),
    
    # NEW: Detail view mapped here to match frontend expectation
    path('admin/fraud-logs/<uuid:log_id>/', fraud_views.fraud_log_detail, name='fraud_log_detail'),
    path('admin/notifications/unread-count/', fraud_views.unread_fraud_count, name='unread_fraud_count'),
    path('admin/notifications/mark-all-reviewed/', fraud_views.mark_all_reviewed, name='mark_all_reviewed'),
    
    path('admin/audit-logs/', dashboard.audit_logs, name='audit_logs'),
    path('admin/voter-stats-chart/', dashboard.voter_stats_chart, name='voter_stats_chart'),

    path('admin/export-report/', dashboard.export_admin_report, name='export_admin_report'),
    
    # Health check
    path('health/', utils.health_check, name='auth_health_check'),
]