from django.core.management.base import BaseCommand
from django.contrib.auth.hashers import make_password
from django.utils import timezone
from accounts.models import SuperAdmin, Admin, Operator
from fraud.models import FraudLog, AuditLog
from verification.models import Voter, BiometricTemplate
import random
from datetime import timedelta

# Sample Data for Randomization
FIRST_NAMES = ['Aarav', 'Vihaan', 'Aditya', 'Sai', 'Reyansh', 'Arjun', 'Vivaan', 'Rohan', 'Ishaan', 'Ayaan', 'Diya', 'Saanvi', 'Ananya', 'Aadhya', 'Pari', 'Anika', 'Navya', 'Myra', 'Riya', 'Kavya']
LAST_NAMES = ['Sharma', 'Verma', 'Gupta', 'Singh', 'Kumar', 'Patel', 'Yadav', 'Das', 'Reddy', 'Nair', 'Mehta', 'Jain', 'Chopra', 'Malhotra', 'Saxena', 'Bhatia', 'Kapoor', 'Khan', 'Joshi', 'Mishra']
CITIES = ['Delhi', 'Mumbai', 'Chennai', 'Kolkata', 'Bangalore', 'Hyderabad', 'Pune', 'Ahmedabad', 'Jaipur', 'Lucknow']

def get_random_name():
    return f"{random.choice(FIRST_NAMES)} {random.choice(LAST_NAMES)}"

class Command(BaseCommand):
    help = 'Seeds the database with randomized demo records'

    def handle(self, *args, **kwargs):
        self.stdout.write('Cleaning up old data...')
        FraudLog.objects.all().delete()
        AuditLog.objects.all().delete()
        Voter.objects.all().delete()
        BiometricTemplate.objects.all().delete()
        
        self.stdout.write('Seeding Multi-Tenant Data...')
        
        # 1. SuperAdmins
        sa1, _ = SuperAdmin.objects.get_or_create(email='superadmin@gmail.com', defaults={'name': 'Chief Commissioner', 'password': make_password('123')})
        sa2, _ = SuperAdmin.objects.get_or_create(email='observer@gmail.com', defaults={'name': 'Election Observer', 'password': make_password('123')})
        
        # 2. Tenant Admins (Districts)
        admins = []
        # Admin 1 (Delhi)
        delhi_admin, _ = Admin.objects.get_or_create(email='admin@gmail.com', defaults={'name': 'Delhi Admin', 'password': make_password('123'), 'created_by': sa1})
        admins.append(delhi_admin)

        # Admin 2 (Mumbai)
        mumbai_admin, _ = Admin.objects.get_or_create(email='mumbai@janmat.com', defaults={'name': 'Mumbai Admin', 'password': make_password('123'), 'created_by': sa1})
        admins.append(mumbai_admin)

        # Admin 3 (Chennai)
        chennai_admin, _ = Admin.objects.get_or_create(email='chennai@janmat.com', defaults={'name': 'Chennai Admin', 'password': make_password('123'), 'created_by': sa2})
        admins.append(chennai_admin)

        self.stdout.write(f'Ensured {len(admins)} Tenant Admins')

        # 3. Create Operators (Random 8-12 per Admin)
        all_operators = []
        for admin_idx, admin in enumerate(admins):
            prefix = ['DL', 'MH', 'TN'][admin_idx]
            num_ops = random.randint(8, 12)
            for i in range(1, num_ops + 1):
                booth_num = f"{prefix}-{random.randint(100, 999)}"
                op_email = f"op.{prefix.lower()}{i}@janmat.com"
                
                Operator.objects.filter(booth_id=booth_num).delete()

                op, _ = Operator.objects.get_or_create(
                    email=op_email,
                    defaults={
                        'password': make_password('123'),
                        'name': f"{get_random_name()} ({prefix})",
                        'booth_id': booth_num,
                        'created_by': admin,
                        'is_active': random.choice([True, True, True, False])
                    }
                )
                if op.created_by != admin:
                    op.created_by = admin
                    op.save()
                    
                all_operators.append(op)

        self.stdout.write(f'Ensured Operators distributed across tenants')

        self.stdout.write('4. Creating Random Fraud Scenarios...')

        # Voter Helper
        def ensure_voter(admin_obj, aadhaar, name=None, voted=False, created_time=None):
            if not name:
                name = get_random_name()
            
            # Randomize DOB
            dob_year = random.randint(1960, 2005)
            dob = f"{dob_year}-{random.randint(1,12):02d}-{random.randint(1,28):02d}"

            v, created = Voter.objects.get_or_create(
                aadhaar_number=aadhaar,
                admin_id=admin_obj.id,
                defaults={
                    'full_name': name,
                    'date_of_birth': dob,
                    'gender': random.choice(['Male', 'Female']),
                    'has_voted': voted,
                    'full_address': f"{random.randint(1, 999)} Street, {random.choice(CITIES)}",
                    'photo_url': f"https://api.dicebear.com/7.x/avataaars/svg?seed={aadhaar}"
                }
            )
            
            # Force update created_at for charts
            if created_time:
                Voter.objects.filter(id=v.id).update(created_at=created_time)
            
            return v

        # Generate Logs
        fraud_types = ['duplicate_biometric', 'multiple_otp_attempts', 'already_voted', 'invalid_session', 'suspicious_activity']
        
        for admin in admins:
            my_ops = [op for op in all_operators if op.created_by_id == admin.id]
            if not my_ops: continue

            # Randomize log count (20-50 logs)
            num_logs = random.randint(20, 50)
            for i in range(num_logs):
                op = random.choice(my_ops)
                f_type = random.choice(fraud_types)
                aadhaar = f"{random.randint(100000000000, 999999999999)}"
                is_voted = (f_type == 'already_voted')
                
                # Distribution: 40% last 24h, 40% last 7d, 20% last 30d
                rand_val = random.random()
                if rand_val < 0.4:
                    # Last 24 hours
                    fake_time = timezone.now() - timedelta(hours=random.randint(0, 23), minutes=random.randint(0, 59))
                elif rand_val < 0.8:
                    # Last 2-7 days
                    fake_time = timezone.now() - timedelta(days=random.randint(1, 6), hours=random.randint(0, 23))
                else:
                    # Last 8-30 days
                    fake_time = timezone.now() - timedelta(days=random.randint(7, 29))

                ensure_voter(admin, aadhaar, voted=is_voted, created_time=fake_time)
                
                log = FraudLog.objects.create(
                    fraud_type=f_type,
                    aadhaar_number=aadhaar,
                    booth_number=op.booth_id,
                    details={'reason': f'Simulated {f_type} randomly'},
                    operator=op,
                    admin=admin,
                    reviewed=random.choice([True, False]),
                    flagged_at=fake_time
                )
                # Force update created_at/flagged_at just in case
                FraudLog.objects.filter(id=log.id).update(flagged_at=fake_time)

        self.stdout.write('Created Randomized Fraud Logs')

        # 5. Background Voters for Stats (Verified Voters Chart)
        self.stdout.write('Seeding background voters...')
        for admin in admins:
            # Randomize background voter count (50-100)
            target_voters = random.randint(50, 100)
            current_count = Voter.objects.filter(admin_id=admin.id).count()
            
            # Create fresh batch
            for i in range(target_voters):
                # Bucketed Time Distribution for Charts
                rand_val = random.random()
                if rand_val < 0.4:
                    # Last 24 hours (High density for daily chart)
                    fake_time = timezone.now() - timedelta(hours=random.randint(0, 23), minutes=random.randint(0, 59))
                elif rand_val < 0.8:
                    # Last 7 days
                    fake_time = timezone.now() - timedelta(days=random.randint(1, 6), hours=random.randint(0, 23))
                else:
                    # Last 30 days
                    fake_time = timezone.now() - timedelta(days=random.randint(7, 29))
                
                dob_year = random.randint(1950, 2004)
                dob = f"{dob_year}-{random.randint(1,12):02d}-{random.randint(1,28):02d}"

                v = Voter.objects.create(
                    aadhaar_number=f"{random.randint(100000000000, 999999999999)}",
                    full_name=get_random_name(),
                    date_of_birth=dob,
                    gender=random.choice(['Male', 'Female']),
                    admin_id=admin.id,
                    operator_id=random.choice([op.id for op in all_operators if op.created_by_id == admin.id]),
                    verified_at=fake_time if random.choice([True, False, True]) else None, 
                    has_voted=random.choice([True, False])
                )
                # Force update created_at for charts
                Voter.objects.filter(id=v.id).update(created_at=fake_time)

        self.stdout.write(self.style.SUCCESS(f'Database randomized!'))

        # 6. Create Audit Logs
        self.stdout.write('Seeding Audit Logs...')
        actions = ['login', 'logout', 'otp_sent', 'admin_action', 'operator_created', 'password_change', 'report_export']
        
        for admin in admins:
            # Randomize audit log count (10-40)
            num_audits = random.randint(10, 40)
            for i in range(num_audits):
                action = random.choice(actions)
                details_map = {
                    'login': {'method': 'password', 'status': 'success'},
                    'logout': {},
                    'otp_sent': {'recipient': f'98765{random.randint(10000,99999)}'},
                    'admin_action': {'target': 'settings', 'change': 'profile_update'},
                    'operator_created': {'booth': f'NewBooth-{random.randint(100,999)}'},
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
                    created_at=timezone.now() - timedelta(hours=random.randint(0, 100), minutes=random.randint(0, 59))
                )

        self.stdout.write(self.style.SUCCESS('Seeding Complete!'))
