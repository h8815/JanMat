from accounts.constants import SystemRoles
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.utils import timezone
from django.db.models import Count, Q
from django.db.models.functions import TruncHour, TruncDay
from django.core.paginator import Paginator
from django.http import HttpResponse
import logging

try:
    from reportlab.lib.pagesizes import letter
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
    from reportlab.lib.styles import getSampleStyleSheet
    from reportlab.lib import colors
except ImportError:
    pass

from ..models import SuperAdmin, Admin, Operator
from ..serializers import SuperAdminSerializer, AdminSerializer
from ..permissions import IsAdmin
from verification.models import Voter, BiometricTemplate
from fraud.models import FraudLog, AuditLog
from verification.services import AuditService

logger = logging.getLogger(__name__)

@api_view(['PUT'])
@permission_classes([IsAuthenticated, IsAdmin])
def update_admin_profile(request):
    user = request.user
    role = getattr(user, 'role', '')
    
    if role not in [SystemRoles.ADMIN, SystemRoles.SUPERUSER]:
        return Response({'error': 'Unauthorized'}, status=403)

    if role == SystemRoles.SUPERUSER:
        serializer = SuperAdminSerializer(user, data=request.data, partial=True)
    else:
        serializer = AdminSerializer(user, data=request.data, partial=True)

    if serializer.is_valid():
        new_email = serializer.validated_data.get('email')
        if new_email and new_email != user.email:
            if role == SystemRoles.ADMIN and Admin.objects.filter(email=new_email).exclude(id=user.id).exists():
                 return Response({'error': 'Email is already taken'}, status=400)
            if role == SystemRoles.SUPERUSER and SuperAdmin.objects.filter(email=new_email).exclude(id=user.id).exists():
                 return Response({'error': 'Email is already taken'}, status=400)

        serializer.save()
        
        try:
            AuditService.log_action(
                action='profile_updated',
                user_type='admin',
                user_id=user.id,
                admin_id=user.id if role == SystemRoles.ADMIN else None,
                ip_address=request.META.get('REMOTE_ADDR'),
                details={'updated_fields': list(request.data.keys())}
            )
        except: pass
        
        return Response({
            'success': True, 
            'message': 'Profile updated successfully',
            'user': serializer.data
        })
    
    return Response({'error': 'Validation failed', 'details': serializer.errors}, status=400)

@api_view(['GET'])
@permission_classes([IsAuthenticated, IsAdmin])
def admin_stats(request):
    try:
        user = request.user
        role = getattr(user, 'role', '')
        
        filters = {}
        if role == SystemRoles.ADMIN:
            filters['admin_id'] = user.id
            op_filters = {'created_by': user}
            fraud_filters = {'admin': user}
        else:
            op_filters = {}
            fraud_filters = {}
            
        today = timezone.now().date()
        
        stats = {
            'active_operators': Operator.objects.filter(is_active=True, **op_filters).count(),
            'total_operators': Operator.objects.filter(**op_filters).count(),
            'total_voters': Voter.objects.filter(**filters).count(),
            'verified_voters': Voter.objects.filter(
                verified_at__isnull=False, **filters
            ).count(),
            'fraud_alerts_today': FraudLog.objects.filter(
                flagged_at__date=today, **fraud_filters
            ).count(),
            'total_fraud_alerts': FraudLog.objects.filter(**fraud_filters).count(),
            'biometric_scans': BiometricTemplate.objects.filter(**filters).count(),
            'verifications_today': Voter.objects.filter(
                verified_at__date=today, **filters
            ).count(),
        }
        
        return Response(stats)
    except Exception as e:
        logger.error(f"Stats error: {e}")
        return Response({'error': 'Failed to load stats'}, status=500)

@api_view(['GET'])
@permission_classes([IsAuthenticated, IsAdmin])
def voter_stats_chart(request):
    try:
        period = request.GET.get('period', '24h')
        now = timezone.now()
        
        if period == '24h':
            start_time = now - timezone.timedelta(hours=24)
            trunc_func = TruncHour('created_at')
            trunc_func_fraud = TruncHour('flagged_at')
            date_format = '%H:00'
            all_points = [(start_time + timezone.timedelta(hours=i)).strftime(date_format) for i in range(25)]
        elif period == '7d':
            start_time = now - timezone.timedelta(days=7)
            trunc_func = TruncDay('created_at')
            trunc_func_fraud = TruncDay('flagged_at')
            date_format = '%Y-%m-%d'
            all_points = [(start_time + timezone.timedelta(days=i)).strftime(date_format) for i in range(8)]
        else:
            start_time = now - timezone.timedelta(days=30)
            trunc_func = TruncDay('created_at')
            trunc_func_fraud = TruncDay('flagged_at')
            date_format = '%Y-%m-%d'
            all_points = [(start_time + timezone.timedelta(days=i)).strftime(date_format) for i in range(31)]

        user = request.user
        role = getattr(user, 'role', '')
        
        filters = {'created_at__gte': start_time}
        fraud_filters = {'flagged_at__gte': start_time}
        
        if role == SystemRoles.ADMIN:
            filters['admin_id'] = user.id
            fraud_filters['admin_id'] = user.id

        voters = Voter.objects.filter(**filters)\
            .annotate(period=trunc_func)\
            .values('period')\
            .annotate(count=Count('id'))\
            .order_by('period')

        fraud = FraudLog.objects.filter(**fraud_filters)\
            .annotate(period=trunc_func_fraud)\
            .values('period')\
            .annotate(count=Count('id'))\
            .order_by('period')

        data_map = {item['period'].strftime(date_format): item['count'] for item in voters}
        fraud_map = {item['period'].strftime(date_format): item['count'] for item in fraud}

        final_voters = [data_map.get(label, 0) for label in all_points]
        final_fraud = [fraud_map.get(label, 0) for label in all_points]

        return Response({
            'labels': all_points,
            'data': final_voters,
            'fraud_data': final_fraud
        })
    except Exception as e:
        logger.error(f"Chart error: {e}")
        return Response({'labels': [], 'data': [], 'fraud_data': []})

@api_view(['GET'])
@permission_classes([IsAuthenticated, IsAdmin])
def audit_logs(request):
    try:
        user = request.user
        role = getattr(user, 'role', '')
        
        if role == SystemRoles.ADMIN:
            queryset = AuditLog.objects.filter(admin_id=user.id)
        elif role == SystemRoles.SUPERUSER:
            queryset = AuditLog.objects.all()
        else:
             queryset = AuditLog.objects.none()
             
        queryset = queryset.order_by('-created_at')

        search_query = request.GET.get('search', '').strip()
        if search_query:
            queryset = queryset.filter(
                Q(action__icontains=search_query) | 
                Q(details__icontains=search_query) |
                Q(ip_address__icontains=search_query) |
                Q(user_type__icontains=search_query)
            )

        page_number = int(request.GET.get('page', 1))
        page_size = int(request.GET.get('limit', 20))
        paginator = Paginator(queryset, page_size)
        
        try:
            page_obj = paginator.page(page_number)
        except Exception:
            page_obj = paginator.page(1)

        data = []
        for log in page_obj:
            user_name = None
            if log.user_id:
                try:
                    if log.user_type == 'operator':
                        op = Operator.objects.filter(id=log.user_id).first()
                        if op:
                            user_name = op.name
                    elif log.user_type == 'admin':
                        adm = Admin.objects.filter(id=log.user_id).first()
                        if adm:
                            user_name = adm.name
                except Exception:
                    pass
            
            data.append({
                'id': str(log.id),
                'action': log.action,
                'user_type': log.user_type,
                'user_id': str(log.user_id) if log.user_id else None,
                'user_name': user_name,
                'resource_type': log.resource_type,
                'details': log.details,
                'ip_address': log.ip_address,
                'timestamp': log.created_at.isoformat()
            })
            
        return Response({
            'logs': data,
            'total': paginator.count,
            'page': page_obj.number,
            'pages': paginator.num_pages,
            'has_next': page_obj.has_next(),
            'has_previous': page_obj.has_previous()
        })
    except Exception as e:
        logger.error(f"Audit log error: {e}")
        return Response({'error': 'Failed to load audit logs'}, status=500)

@api_view(['GET'])
@permission_classes([IsAuthenticated, IsAdmin])
def export_admin_report(request):
    try:
        user = request.user
        role = getattr(user, 'role', '')
        
        start_date = request.GET.get('start_date', '').strip()
        end_date   = request.GET.get('end_date', '').strip()
        report_type = request.GET.get('report_type', 'full').strip().lower()
        limit      = min(int(request.GET.get('limit', 10000)), 50000)

        filters = {}
        if role == SystemRoles.ADMIN:
            filters['admin_id'] = user.id
            op_filters = {'created_by': user}
            fraud_filters = {'admin': user}
            audit_filters = {'admin_id': user.id}
        else:
            op_filters = {}
            fraud_filters = {}
            audit_filters = {}

        if start_date:
            fraud_filters['flagged_at__date__gte'] = start_date
            audit_filters['created_at__date__gte'] = start_date
        if end_date:
            fraud_filters['flagged_at__date__lte'] = end_date
            audit_filters['created_at__date__lte'] = end_date

        t = {
            'title': 'JanMat Admin Report',
            'date': 'Date',
            'gen_by': 'Generated by',
            'stats': 'Key Statistics',
            'ops_list': 'Operators List',
            'fraud_logs': f'Recent Fraud Alerts (Limit: {limit})',
            'audit_logs': f'Recent Audit Logs (Limit: {limit})',
            'no_ops': 'No operators found.',
            'no_fraud': 'No fraud alerts found.',
            'no_audit': 'No audit logs found.',
            'col_time': 'Time', 'col_type': 'Type', 'col_booth': 'Booth', 'col_op': 'Operator', 'col_admin': 'Admin',
            'col_name': 'Name', 'col_email': 'Email', 'col_status': 'Status',
            'col_action': 'Action', 'col_role': 'Role', 'col_user': 'Username', 'col_ip': 'IP',
            'active': 'Active', 'inactive': 'Inactive',
            'status_verified': 'Verified Voters',
            'status_fraud': 'Fraud Alerts',
            'status_total_op': 'Total Operators',
            'status_total_voter': 'Total Registered Voters'
        }

        stats = {}
        if report_type in ['full', 'verifications', 'operators']:
            stats[t['status_total_op']] = Operator.objects.filter(**op_filters).count()
            stats[t['status_total_voter']] = Voter.objects.filter(**filters).count()
            stats[t['status_verified']] = Voter.objects.filter(verified_at__isnull=False, **filters).count()
        if report_type in ['full', 'fraud']:
            stats[t['status_fraud']] = FraudLog.objects.filter(**fraud_filters).count()

        operator_data = []
        if report_type in ['full', 'operators']:
            ops = Operator.objects.filter(**op_filters).values_list('name', 'email', 'booth_id', 'is_active')
            operator_data = [[t['col_name'], t['col_email'], t['col_booth'], t['col_status']]] + [
                [op[0], op[1], op[2], t['active'] if op[3] else t['inactive']] for op in ops
            ]

        fraud_data = []
        if report_type in ['full', 'fraud']:
            fraud_logs = FraudLog.objects.filter(**fraud_filters).select_related('operator', 'admin').order_by('-flagged_at')[:limit]
            fraud_data = [[t['col_time'], t['col_type'], t['col_booth'], t['col_op'], t['col_admin']]]
            for log in fraud_logs:
                op_name = log.operator.name if log.operator else 'Unknown'
                if log.operator and not op_name: op_name = log.operator.email
                admin_name = log.admin.name if log.admin else 'System'
                fraud_data.append([
                    log.flagged_at.strftime("%Y-%m-%d %H:%M"),
                    log.fraud_type.replace('_', ' ').title(),
                    log.booth_number,
                    op_name,
                    admin_name
                ])

        audit_table_data = []
        if report_type in ['full', 'audit']:
            audit_qs = AuditLog.objects.filter(**audit_filters).order_by('-created_at')[:limit]
            
            admin_map = {str(a.id): a.name for a in Admin.objects.all()}
            op_map = {str(o.id): o.name or o.full_name for o in Operator.objects.all()}
            
            audit_table_data = [[t['col_time'], t['col_action'], t['col_role'], t['col_user'], t['col_ip']]]
            for log in audit_qs:
                uid = str(log.user_id)
                username = 'Unknown'
                if log.user_type == 'admin':
                    username = admin_map.get(uid, uid)
                elif log.user_type == 'operator':
                    username = op_map.get(uid, uid)
                elif log.user_type == 'superadmin':
                    username = 'SuperAdmin'
                    
                audit_table_data.append([
                    log.created_at.strftime("%Y-%m-%d %H:%M"),
                    log.action,
                    log.user_type.upper(),
                    username,
                    log.ip_address
                ])

        response = HttpResponse(content_type='application/pdf')
        filename_prefix = "admin_report"
        if report_type != "full":
            filename_prefix = f"admin_{report_type}_report"
        response['Content-Disposition'] = f'attachment; filename="{filename_prefix}_{timezone.now().date()}.pdf"'

        doc = SimpleDocTemplate(response, pagesize=letter)
        elements = []
        
        JANMAT_BLUE = colors.HexColor('#0B3D91')
        HEADER_BG = JANMAT_BLUE
        HEADER_TEXT = colors.whitesmoke
        
        def hex_to_rgb_alpha(hex_code, alpha=1):
            hex_code = hex_code.lstrip('#')
            r, g, b = tuple(int(hex_code[i:i+2], 16)/255.0 for i in (0, 2, 4))
            return colors.Color(r, g, b, alpha=alpha)

        ROW_BG = hex_to_rgb_alpha('#F8FAFC', 0.6)
        ROW_WHITE = hex_to_rgb_alpha('#FFFFFF', 0.4)
        
        styles = getSampleStyleSheet()
        title_style = styles['Title']
        title_style.textColor = JANMAT_BLUE
        
        heading_style = styles['Heading2']
        heading_style.textColor = JANMAT_BLUE
        heading_style.spaceBefore = 20
        heading_style.spaceAfter = 10

        elements.append(Paragraph(t['title'], title_style))
        date_str = timezone.now().date().strftime("%Y-%m-%d")
        if start_date or end_date:
            date_str = f"{start_date or 'Beginning'} to {end_date or 'Now'}"
        elements.append(Paragraph(f"{t['date']}: {date_str}", styles['Normal']))
        admin_name = getattr(user, 'name', getattr(user, 'full_name', 'System Admin'))
        elements.append(Paragraph(f"{t['gen_by']}: {user.email} | {admin_name}", styles['Normal']))
        elements.append(Spacer(1, 20))

        if stats:
            elements.append(Paragraph(t['stats'], heading_style))
            stats_data = [[k, str(v)] for k, v in stats.items()]
            t_stats = Table(stats_data, colWidths=[200, 100], hAlign='LEFT')
            t_stats.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (0, -1), colors.HexColor('#E2E8F0')),
                ('TEXTCOLOR', (0, 0), (0, -1), colors.black),
                ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
                ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 10),
                ('TOPPADDING', (0, 0), (-1, -1), 10),
                ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
            ]))
            elements.append(t_stats)
            
        if report_type in ['full', 'operators']:
            elements.append(Paragraph(t['ops_list'], heading_style))
            if len(operator_data) > 1:
                t_ops = Table(operator_data, repeatRows=1, colWidths=[120, 180, 100, 80], hAlign='LEFT')
                t_ops.setStyle(TableStyle([
                    ('BACKGROUND', (0, 0), (-1, 0), HEADER_BG),
                    ('TEXTCOLOR', (0, 0), (-1, 0), HEADER_TEXT),
                    ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                    ('FONTSIZE', (0, 0), (-1, 0), 10),
                    ('TOPPADDING', (0, 0), (-1, 0), 8),
                    ('BOTTOMPADDING', (0, 0), (-1, 0), 8),
                    ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
                    ('FONTSIZE', (0, 1), (-1, -1), 9),
                    ('TOPPADDING', (0, 1), (-1, -1), 6),
                    ('BOTTOMPADDING', (0, 1), (-1, -1), 6),
                    ('TEXTCOLOR', (0, 1), (-1, -1), colors.black),
                    ('ROWBACKGROUNDS', (0, 1), (-1, -1), [ROW_BG, ROW_WHITE]),
                    ('GRID', (0, 0), (-1, -1), 0.5, colors.lightgrey),
                ]))
                elements.append(t_ops)
            else:
                elements.append(Paragraph(t['no_ops'], styles['Normal']))

        if report_type in ['full', 'fraud']:
            elements.append(Paragraph(t['fraud_logs'], heading_style))
            if len(fraud_data) > 1:
                t_fraud = Table(fraud_data, repeatRows=1, colWidths=[90, 110, 80, 120, 100], hAlign='LEFT')
                t_fraud.setStyle(TableStyle([
                    ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#DC2626')),
                    ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
                    ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                    ('FONTSIZE', (0, 0), (-1, 0), 9),
                    ('TOPPADDING', (0, 0), (-1, 0), 8),
                    ('BOTTOMPADDING', (0, 0), (-1, 0), 8),
                    ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
                    ('FONTSIZE', (0, 1), (-1, -1), 8),
                    ('TOPPADDING', (0, 1), (-1, -1), 6),
                    ('BOTTOMPADDING', (0, 1), (-1, -1), 6),
                    ('TEXTCOLOR', (0, 1), (-1, -1), colors.black),
                    ('ROWBACKGROUNDS', (0, 1), (-1, -1), [ROW_BG, ROW_WHITE]),
                    ('GRID', (0, 0), (-1, -1), 0.5, colors.lightgrey),
                ]))
                elements.append(t_fraud)
            else:
                elements.append(Paragraph(t['no_fraud'], styles['Normal']))

        if report_type in ['full', 'audit']:
            elements.append(Paragraph(t['audit_logs'], heading_style))
            if len(audit_table_data) > 1:
                t_audit = Table(audit_table_data, repeatRows=1, colWidths=[90, 100, 70, 120, 100], hAlign='LEFT')
                t_audit.setStyle(TableStyle([
                    ('BACKGROUND', (0, 0), (-1, 0), JANMAT_BLUE),
                    ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
                    ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                    ('FONTSIZE', (0, 0), (-1, 0), 9),
                    ('TOPPADDING', (0, 0), (-1, 0), 8),
                    ('BOTTOMPADDING', (0, 0), (-1, 0), 8),
                    ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
                    ('FONTSIZE', (0, 1), (-1, -1), 8),
                    ('TOPPADDING', (0, 1), (-1, -1), 6),
                    ('BOTTOMPADDING', (0, 1), (-1, -1), 6),
                    ('TEXTCOLOR', (0, 1), (-1, -1), colors.black),
                    ('ROWBACKGROUNDS', (0, 1), (-1, -1), [ROW_BG, ROW_WHITE]),
                    ('GRID', (0, 0), (-1, -1), 0.5, colors.lightgrey),
                ]))
                elements.append(t_audit)
            else:
                 elements.append(Paragraph(t['no_audit'], styles['Normal']))

        def add_watermark(canvas, doc):
            canvas.saveState()
            import os
            from django.conf import settings
            
            watermark_path = os.path.join(settings.BASE_DIR, 'static', 'assets', 'images', 'ashoka.png')
            if os.path.exists(watermark_path):
                img_width = 300
                img_height = 400
                canvas.setFillAlpha(0.35)
                try: 
                    canvas.drawImage(watermark_path, (letter[0] - img_width) / 2, (letter[1] - img_height) / 2, width=img_width, height=img_height, mask='auto', preserveAspectRatio=True)
                except Exception as img_err:
                    print(f"Watermark error: {img_err}")
                canvas.setFillAlpha(1)

            logo_path = os.path.join(settings.BASE_DIR, 'static', 'assets', 'images', 'ashoka-black.png')
            if os.path.exists(logo_path):
                logo_width = 50
                logo_height = 50
                try:
                    canvas.drawImage(logo_path, 530, 730, width=logo_width, height=logo_height, mask='auto', preserveAspectRatio=True)
                except Exception as logo_err:
                    print(f"Logo error: {logo_err}")

            canvas.restoreState()

        doc.build(elements, onFirstPage=add_watermark, onLaterPages=add_watermark)
        return response

    except Exception as e:
        logger.error(f"Export error: {e}")
        return Response({'error': 'Failed to generate report'}, status=500)
