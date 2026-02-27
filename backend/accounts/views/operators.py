from accounts.constants import SystemRoles
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.utils import timezone
from django.db import transaction
from django.db.models import Count
from django.contrib.auth.hashers import make_password
import logging

from ..models import Operator
from ..serializers import CreateOperatorSerializer, OperatorSerializer
from ..permissions import IsAdmin
from .utils import generate_temp_password, get_shortform
from ..utils import send_mail_async
from verification.models import Voter
from fraud.models import FraudLog
from verification.services import AuditService

logger = logging.getLogger(__name__)

@api_view(['POST'])
@permission_classes([IsAuthenticated, IsAdmin])
def create_operator(request):
    serializer = CreateOperatorSerializer(data=request.data)
    if not serializer.is_valid():
        return Response({'error': 'Validation failed', 'details': serializer.errors}, status=400)
    
    try:
        creator = request.user
        creator_role = getattr(creator, 'role', '')
        
        admin_ref = None
        if creator_role == SystemRoles.ADMIN:
            admin_ref = creator
        elif creator_role == SystemRoles.SUPERUSER:
             return Response({'error': 'Only Admins can create Operators currently'}, status=403)
        
        with transaction.atomic():
            temp_password = generate_temp_password()
            
            name_part = "".join(filter(str.isalnum, (serializer.validated_data.get('full_name', 'operator')).split()[0].lower()))
            state_part = get_shortform(admin_ref.state if admin_ref and admin_ref.state else "st")
            dist_part = get_shortform(admin_ref.district if admin_ref and admin_ref.district else "dt")
            tehsil_part = get_shortform(admin_ref.tehsil if admin_ref and admin_ref.tehsil else "th")
            
            geo_string = f"{state_part.upper()}{dist_part}{tehsil_part.upper()}"
            base_username = f"operator-{name_part}.{geo_string}.janmat.gov.in"
            
            counter = 1
            final_username = base_username
            while Operator.objects.filter(username=final_username).exists():
                final_username = f"operator-{name_part}{counter}.{geo_string}.janmat.gov.in"
                counter += 1
            
            op_count = Operator.objects.filter(created_by=admin_ref).count() + 1
            generated_booth_id = f"{dist_part.upper()}-{tehsil_part.upper()}-B{str(op_count).zfill(3)}"
            
            operator = Operator.objects.create(
                username=final_username,
                email=serializer.validated_data['email'],
                password=make_password(temp_password),
                name=serializer.validated_data.get('full_name', ''),
                booth_id=generated_booth_id,
                created_by=admin_ref,
                must_change_password=True,
                is_active=True
            )
            
        AuditService.log_action(
            action='operator_created',
            user_type='admin',
            user_id=creator.id,
            admin_id=admin_ref.id,
            resource_type='operator',
            resource_id=operator.id,
            details={'email': operator.email, 'booth': operator.booth_id},
            ip_address=request.META.get('REMOTE_ADDR')
        )
        
        return Response({
            'success': True,
            'message': 'Operator created',
            'operator': OperatorSerializer(operator).data
        }, status=201)
        
    except Exception as e:
        logger.error(f"Create op error: {e}")
        return Response({'error': 'Failed to create operator'}, status=500)

@api_view(['GET'])
@permission_classes([IsAuthenticated, IsAdmin])
def list_operators(request):
    try:
        user = request.user
        role = getattr(user, 'role', '')
        
        if role == SystemRoles.ADMIN:
            operators = Operator.objects.filter(created_by=user)
        elif role == SystemRoles.SUPERUSER:
            operators = Operator.objects.all()
        else:
            return Response([])
            
        operators = operators.annotate(fraud_count=Count('fraudlog'))
        op_ids = [op.id for op in operators]
        voter_counts = (
            Voter.objects.filter(operator_id__in=op_ids, verified_at__isnull=False)
            .values('operator_id')
            .annotate(count=Count('id'))
        )
        verification_map = {str(v['operator_id']): v['count'] for v in voter_counts if v['operator_id']}
        
        data = []
        for op in operators:
            serialized = OperatorSerializer(op).data
            serialized['metrics'] = {
                'verifications': verification_map.get(str(op.id), 0),
                'fraud_flags': op.fraud_count
            }
            data.append(serialized)
            
        return Response(data)
    except Exception as e:
        logger.error(f"List Operators error: {e}")
        return Response({'error': 'Failed to load operators'}, status=500)

@api_view(['GET', 'PUT', 'DELETE'])
@permission_classes([IsAuthenticated, IsAdmin])
def manage_operator(request, pk):
    try:
        user = request.user
        role = getattr(user, 'role', '')
        
        if role == SystemRoles.SUPERUSER:
            operator = Operator.objects.get(pk=pk)
        elif role == SystemRoles.ADMIN:
            operator = Operator.objects.get(pk=pk, created_by=user)
        else:
            return Response({'error': 'Unauthorized'}, status=403)
            
        if request.method == 'GET':
            return Response(OperatorSerializer(operator).data)
            
        elif request.method == 'PUT':
            serializer = OperatorSerializer(operator, data=request.data, partial=True)
            if serializer.is_valid():
                serializer.save()
                return Response(serializer.data)
            return Response(serializer.errors, status=400)
            
        elif request.method == 'DELETE':
            operator.delete()
            return Response({'message': 'Operator deleted successfully'}, status=204)
            
    except Operator.DoesNotExist:
        return Response({'error': 'Operator not found'}, status=404)
    except Exception as e:
        logger.error(f"Manage Operator error: {e}")
        return Response({'error': 'Operation failed'}, status=500)

@api_view(['POST'])
@permission_classes([IsAuthenticated, IsAdmin])
def toggle_operator_status(request, pk):
    try:
        user = request.user
        role = getattr(user, 'role', '')

        if role == SystemRoles.SUPERUSER:
            operator = Operator.objects.get(pk=pk)
        elif role == SystemRoles.ADMIN:
            operator = Operator.objects.get(pk=pk, created_by=user)
        else:
            return Response({'error': 'Unauthorized'}, status=403)

        operator.is_active = not operator.is_active
        operator.save(update_fields=['is_active'])

        action = 'operator_activated' if operator.is_active else 'operator_deactivated'
        try:
            AuditService.log_action(
                action=action,
                user_type='admin',
                user_id=user.id,
                admin_id=user.id if role == SystemRoles.ADMIN else None,
                resource_type='operator',
                resource_id=operator.id,
                details={'new_status': operator.is_active},
                ip_address=request.META.get('REMOTE_ADDR')
            )
        except Exception as audit_err:
            logger.warning(f"Audit log failed: {audit_err}")

        return Response({
            'success': True,
            'is_active': operator.is_active,
            'message': f"Operator {'activated' if operator.is_active else 'deactivated'} successfully"
        })

    except Operator.DoesNotExist:
        return Response({'error': 'Operator not found'}, status=404)
    except Exception as e:
        logger.error(f"Toggle status error: {e}")
        return Response({'error': 'Failed to toggle status'}, status=500)

@api_view(['POST'])
@permission_classes([IsAuthenticated, IsAdmin])
def bulk_operator_action(request):
    try:
        user = request.user
        role = getattr(user, 'role', '')
        
        ids = request.data.get('ids', [])
        action = request.data.get('action', '')
        
        if not ids or not isinstance(ids, list):
            return Response({'error': 'Invalid or empty ID list'}, status=400)
            
        if not action:
            return Response({'error': 'Action required'}, status=400)
            
        if role == SystemRoles.ADMIN:
            queryset = Operator.objects.filter(id__in=ids, created_by=user)
        elif role == SystemRoles.SUPERUSER:
            queryset = Operator.objects.filter(id__in=ids)
        else:
            return Response({'error': 'Unauthorized'}, status=403)
            
        if not queryset.exists():
            return Response({'error': 'No valid operators found for this action'}, status=404)
        
        updated_count = 0
        
        if action == 'activate':
            updated_count = queryset.update(is_active=True)
            log_action = 'bulk_activate'
        elif action == 'deactivate':
            updated_count = queryset.update(is_active=False)
            log_action = 'bulk_deactivate'
        elif action == 'delete':
            updated_count = queryset.count()
            queryset.delete()
            log_action = 'bulk_delete'
        elif action == 'send_credentials':
            updated_count = queryset.count()
            log_action = 'bulk_credentials_sent'
            admin_contact = user if role == SystemRoles.ADMIN else None
            admin_email = admin_contact.email if admin_contact else 'N/A'
            admin_phone = admin_contact.phone_number if admin_contact and getattr(admin_contact, 'phone_number', None) else 'N/A'
            
            for op in queryset:
                temp_password = generate_temp_password()
                op.password = make_password(temp_password)
                op.must_change_password = True
                op.save(update_fields=['password', 'must_change_password'])
                
                subject = "Your JanMat Operator Account Credentials"
                message = f"Welcome {op.name or 'Operator'}!\n\nYour account is ready for Booth {op.booth_id}.\n\nYour login details are:\nUsername: {op.username}\nTemporary Password: {temp_password}\n\nPlease login to the portal. You will be required to change your password immediately upon your first login for security reasons.\n\nFor any issues or queries, please contact your Admin:\nEmail: {admin_email}\nPhone: {admin_phone}\n\nRegards,\nJanMat System"
                send_mail_async(subject, message, [op.email])
        else:
            return Response({'error': 'Invalid action'}, status=400)
            
        try:
            AuditService.log_action(
                action=log_action,
                user_type='admin',
                user_id=user.id,
                admin_id=user.id if role == SystemRoles.ADMIN else None,
                resource_type='operator',
                details={'count': updated_count, 'ids': ids},
                ip_address=request.META.get('REMOTE_ADDR')
            )
        except Exception as audit_err:
            logger.warning(f"Audit log failed: {audit_err}")

        return Response({
            'success': True,
            'message': f'Successfully performed "{action}" on {updated_count} operators',
            'count': updated_count
        })

    except Exception as e:
        logger.error(f"Bulk action error: {e}")
        return Response({'error': 'Failed to perform bulk action'}, status=500)

@api_view(['POST'])
@permission_classes([IsAuthenticated, IsAdmin])
def send_operator_credentials(request, pk):
    try:
        operator = Operator.objects.get(pk=pk)
        
        if hasattr(request.user, 'admin_profile'):
            if operator.created_by != request.user.admin_profile:
                return Response({'error': 'Unauthorized to manage this operator'}, status=403)
        elif hasattr(request.user, 'super_admin_profile'):
             if operator.created_by.created_by != request.user.super_admin_profile:
                return Response({'error': 'Unauthorized'}, status=403)
        
        temp_password = generate_temp_password()
        operator.password = make_password(temp_password)
        operator.must_change_password = True
        operator.save(update_fields=['password', 'must_change_password'])
        
        admin_contact = operator.created_by
        admin_email = admin_contact.email if admin_contact else 'N/A'
        admin_phone = admin_contact.phone_number if admin_contact and getattr(admin_contact, 'phone_number', None) else 'N/A'

        subject = "Your JanMat Operator Account Credentials"
        message = f"Welcome {operator.name or 'Operator'}!\n\nYour account is ready for Booth {operator.booth_id}.\n\nYour login details are:\nUsername: {operator.username}\nTemporary Password: {temp_password}\n\nPlease login to the portal. You will be required to change your password immediately upon your first login for security reasons.\n\nFor any issues or queries, please contact your Admin:\nEmail: {admin_email}\nPhone: {admin_phone}\n\nRegards,\nJanMat System"
        
        send_mail_async(subject, message, [operator.email])
        
        return Response({'success': True, 'message': 'Credentials sent successfully.'})
        
    except Operator.DoesNotExist:
        return Response({'error': 'Operator not found'}, status=404)
    except Exception as e:
        logger.error(f"Failed to send credentials to operator {pk}: {e}")
        return Response({'error': 'Failed to send email'}, status=500)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def operator_stats(request):
    user = request.user
    role = getattr(user, 'role', '')
    
    if role != SystemRoles.OPERATOR:
        return Response({'error': 'Unauthorized'}, status=403)
        
    try:
        now = timezone.now()
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        
        today_verifications = Voter.objects.filter(operator_id=user.id, verified_at__gte=today_start).count()
        total_verifications = Voter.objects.filter(operator_id=user.id).count()
        
        fraud_qs = FraudLog.objects.filter(operator_id=user.id)
        fraud_alerts_today = fraud_qs.filter(flagged_at__gte=today_start).count()
        pending_fraud_alerts = fraud_qs.filter(reviewed=False).count()
        
        recent_voters = Voter.objects.filter(
            operator_id=user.id,
            verified_at__gte=today_start
        ).order_by('-verified_at')[:5]
        
        recent_list = []
        for v in recent_voters:
            recent_list.append({
                'name': v.full_name,
                'aadhaar_masked': f"XXXX-{v.aadhaar_number[-4:]}" if v.aadhaar_number else '',
                'time': v.verified_at.strftime('%H:%M') if v.verified_at else '',
            })
        
        return Response({
            'today_verifications': today_verifications,
            'total_verifications': total_verifications,
            'fraud_alerts_today': fraud_alerts_today,
            'pending_fraud_alerts': pending_fraud_alerts,
            'booth_id': getattr(user, 'booth_id', None),
            'recent_verifications': recent_list,
        })
    except Exception as e:
        logger.error(f"Operator stats error: {e}")
        return Response({'error': 'Failed to load stats'}, status=500)
