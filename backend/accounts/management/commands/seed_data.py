from django.core.management.base import BaseCommand
from django.contrib.auth.hashers import make_password
from django.utils import timezone
from accounts.models import SuperAdmin, Admin, Operator
from fraud.models import FraudLog, AuditLog
from verification.models import Voter
import random
from datetime import timedelta

class Command(BaseCommand):
    help = 'Seeds the database with 50+ demo records'

    def handle(self, *args, **kwargs):
        self.stdout.write('Seeding Multi-Tenant Data...')
        
        # 1. SuperAdmins
        sa1, _ = SuperAdmin.objects.get_or_create(email='superadmin@gmail.com', defaults={'name': 'Chief Commissioner', 'password': make_password('123')})
        sa2, _ = SuperAdmin.objects.get_or_create(email='observer@gmail.com', defaults={'name': 'Election Observer', 'password': make_password('123')})
        
        # 2. Tenant Admins (Districts)
        admins = []
        # Admin 1 (Delhi) - The original one for backward compatibility
        delhi_admin, _ = Admin.objects.get_or_create(email='admin@gmail.com', defaults={'name': 'Delhi Admin', 'password': make_password('123'), 'created_by': sa1})
        if delhi_admin.name != 'Delhi Admin':
            delhi_admin.name = 'Delhi Admin'
            delhi_admin.save()
        admins.append(delhi_admin)

        # Admin 2 (Mumbai)
        mumbai_admin, _ = Admin.objects.get_or_create(email='mumbai@janmat.com', defaults={'name': 'Mumbai Admin', 'password': make_password('123'), 'created_by': sa1})
        admins.append(mumbai_admin)

        # Admin 3 (Chennai)
        chennai_admin, _ = Admin.objects.get_or_create(email='chennai@janmat.com', defaults={'name': 'Chennai Admin', 'password': make_password('123'), 'created_by': sa2})
        admins.append(chennai_admin)

        self.stdout.write(f'Ensured {len(admins)} Tenant Admins: Delhi, Mumbai, Chennai')

        # 3. Create 30 Operators (10 per Admin)
        all_operators = []
        for admin_idx, admin in enumerate(admins):
            prefix = ['DL', 'MH', 'TN'][admin_idx]
            for i in range(1, 11):
                booth_num = f"{prefix}-{i:03d}"
                op_email = f"op.{prefix.lower()}{i}@janmat.com"
                
                # Cleanup old duplicates if needed (simple check)
                Operator.objects.filter(booth_id=booth_num).delete()

                op, _ = Operator.objects.get_or_create(
                    email=op_email,
                    defaults={
                        'password': make_password('123'),
                        'name': f"{prefix} Operator {i}",
                        'booth_id': booth_num,
                        'created_by': admin,
                        'is_active': random.choice([True, True, True, False])
                    }
                )
                # Ensure correct ownership if it already existed
                if op.created_by != admin:
                    op.created_by = admin
                    op.save()
                    
                all_operators.append(op)

        self.stdout.write(f'Ensured {len(all_operators)} Operators distributed across tenants')

        self.stdout.write('4. Creating Realistic Fraud Scenarios...')

        # Voter Helper
        def ensure_voter(admin_obj, aadhaar, name, voted=False):
            v, _ = Voter.objects.get_or_create(
                aadhaar_number=aadhaar,
                admin_id=admin_obj.id,
                defaults={
                    'full_name': name,
                    'date_of_birth': "1990-01-01",
                    'gender': random.choice(['Male', 'Female']),
                    'has_voted': voted,
                    'full_address': f"123 Street, {admin_obj.name.split()[0]}",
                    'photo_url': f"https://api.dicebear.com/7.x/avataaars/svg?seed={aadhaar}"
                }
            )
            return v

        # Generate Logs
        fraud_types = ['duplicate_biometric', 'multiple_otp_attempts', 'already_voted', 'invalid_session', 'suspicious_activity']
        
        for admin in admins:
            # Filter operators for this admin
            my_ops = [op for op in all_operators if op.created_by_id == admin.id]
            if not my_ops: continue

            # generate 20 logs per admin
            for i in range(20):
                op = random.choice(my_ops)
                f_type = random.choice(fraud_types)
                aadhaar = f"{random.randint(100000000000, 999999999999)}"
                
                # Ensure linked voter exists for context
                voter_name = f"Voter {i} of {admin.name}"
                is_voted = (f_type == 'already_voted')
                
                ensure_voter(admin, aadhaar, voter_name, voted=is_voted)
                
                FraudLog.objects.create(
                    fraud_type=f_type,
                    aadhaar_number=aadhaar,
                    booth_number=op.booth_id,
                    details={'reason': f'Simulated {f_type}'},
                    operator=op,
                    admin=admin,
                    reviewed=random.choice([True, False]),
                    flagged_at=timezone.now() - timedelta(hours=random.randint(0, 100))
                )

        self.stdout.write('Created Fraud Logs for all tenants')

        # 5. Background Voters for Stats
        self.stdout.write('Seeding background voters...')
        for admin in admins:
            if Voter.objects.filter(admin_id=admin.id).count() < 50:
                for i in range(50):
                    fake_time = timezone.now() - timedelta(days=random.randint(0, 30))
                    Voter.objects.create(
                        aadhaar_number=f"{random.randint(100000000000, 999999999999)}",
                        full_name=f"Citizen {i}",
                        date_of_birth="1985-05-20",
                        gender=random.choice(['Male', 'Female']),
                        admin_id=admin.id,
                        verified_at=fake_time if random.choice([True, False]) else None,
                        has_voted=False
                    )

        self.stdout.write(self.style.SUCCESS(f'Database populated! SuperAdmins: 2, Admins: {len(admins)}, Operators: {len(all_operators)}'))

        # 6. Create Audit Logs for All Admins
        self.stdout.write('Seeding Audit Logs...')
        actions = ['login', 'logout', 'otp_sent', 'admin_action', 'operator_created', 'password_change', 'report_export']
        
        for admin in admins:
            # Generate 20 audit logs per admin
            for i in range(20):
                action = random.choice(actions)
                details_map = {
                    'login': {'method': 'password', 'status': 'success'},
                    'logout': {},
                    'otp_sent': {'recipient': f'98765{random.randint(10000,99999)}'},
                    'admin_action': {'target': 'settings', 'change': 'profile_update'},
                    'operator_created': {'booth': f'NewBooth-{i}'},
                    'password_change': {'user_id': str(admin.id)},
                    'report_export': {'format': 'pdf'}
                }
                
                AuditLog.objects.create(
                    action=action,
                    user_type='admin',
                    user_id=admin.id,
                    admin=admin,
                    details=details_map.get(action, {'info': 'Log entry'}),
                    ip_address=f'192.168.1.{random.randint(1, 255)}',
                    created_at=timezone.now() - timedelta(hours=random.randint(0, 100))
                )

        self.stdout.write(self.style.SUCCESS('Seeded Audit Logs for all tenants!'))

