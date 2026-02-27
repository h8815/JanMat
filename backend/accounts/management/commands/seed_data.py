# # ONLY CREATING SUPER ADMINs

# from django.core.management.base import BaseCommand
# from django.contrib.auth.hashers import make_password
# from accounts.models import SuperAdmin

# class Command(BaseCommand):
#     help = 'Creates super admins for the system'

#     def handle(self, *args, **kwargs):
#         self.stdout.write('Creating super admins...')
        
#         # Create super admins
#         super_admins_data = [
#             {
#                 'email': 'babitaji81815@gmail.com',
#                 'name': 'Chief Commissioner 1',
#                 'username': 'superadmin1',
#                 'password': '123'    
#             },
#             {
#                 'email': 'sc23cs301052@medicaps.ac.in',
#                 'name': 'Chief Commissioner 2',
#                 'username': 'superadmin2',
#                 'password': '123'
#             }
#         ]
        
#         created_count = 0
#         existing_count = 0
        
#         for admin_data in super_admins_data:
#             super_admin, created = SuperAdmin.objects.get_or_create(
#                 email=admin_data['email'],
#                 defaults={
#                     'name': admin_data['name'],
#                     'username': admin_data['username'],
#                     'password': make_password(admin_data['password'])
#                 }
#             )
            
#             if created:
#                 created_count += 1
#                 self.stdout.write(self.style.SUCCESS(f'Created: {admin_data["email"]}'))
#             else:
#                 existing_count += 1
#                 self.stdout.write(self.style.WARNING(f'Already exists: {admin_data["email"]}'))
        
#         # Summary
#         self.stdout.write(self.style.SUCCESS(f'\nSummary:'))
#         self.stdout.write(self.style.SUCCESS(f'Created: {created_count} super admin(s)'))
#         self.stdout.write(self.style.SUCCESS(f'Already existed: {existing_count} super admin(s)'))
        
#         # Display login credentials
#         self.stdout.write(self.style.SUCCESS('\nLogin Credentials:'))
#         for admin_data in super_admins_data:
#             self.stdout.write(f'\nEmail: {admin_data["email"]}')
#             self.stdout.write(f'Password: {admin_data["password"]}')
#             self.stdout.write(f'Username: {admin_data["username"]}')


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
        Operator.objects.all().delete()
        
        self.stdout.write('Seeding specific data...')
        
        # 1. SuperAdmins (2)
        sa1, _ = SuperAdmin.objects.get_or_create(
            email='babitaji81815@gmail.com', 
            defaults={'name': 'Chief Commissioner 1', 'username': 'superadmin1', 'password': make_password('123')}
        )
        sa2, _ = SuperAdmin.objects.get_or_create(
            email='sc23cs301052@medicaps.ac.in', 
            defaults={'name': 'Chief Commissioner 2', 'username': 'superadmin2', 'password': make_password('123')}
        )
        
        # 2. Tenant Admins (2)
        admins = []
        admin1, _ = Admin.objects.get_or_create(
            email='babitaji81815@gmail.com', 
            defaults={'name': 'Admin One', 'username': 'admin1', 'password': make_password('123'), 'created_by': sa1}
        )
        admins.append(admin1)

        admin2, _ = Admin.objects.get_or_create(
            email='sc23cs301052@medicaps.ac.in', 
            defaults={'name': 'Admin Two', 'username': 'admin2', 'password': make_password('123'), 'created_by': sa2}
        )
        admins.append(admin2)

        self.stdout.write(f'Ensured Tenant Admins')

        # 3. Create Operators (2)
        all_operators = []
        
        op1, _ = Operator.objects.get_or_create(
            email='babitaji81815@gmail.com',
            defaults={
                'username': 'operator1',
                'password': make_password('123'),
                'name': 'Operator One',
                'booth_id': 'DL-101',
                'created_by': admin1,
                'is_active': True
            }
        )
        all_operators.append(op1)

        op2, _ = Operator.objects.get_or_create(
            email='sc23cs301052@medicaps.ac.in',
            defaults={
                'username': 'operator2',
                'password': make_password('123'),
                'name': 'Operator Two',
                'booth_id': 'MH-202',
                'created_by': admin2,
                'is_active': True
            }
        )
        all_operators.append(op2)

        self.stdout.write(f'Ensured Operators')

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