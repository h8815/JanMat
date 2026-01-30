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
        self.stdout.write('Seeding 50+ records...')
        
        # 1. SuperAdmin & Admin
        sa, _ = SuperAdmin.objects.get_or_create(email='superadmin@gmail.com', defaults={'name': 'SuperAdmin', 'password': make_password('123')})
        admin, _ = Admin.objects.get_or_create(email='admin@gmail.com', defaults={'name': 'JanmatAdmin', 'password': make_password('123'), 'created_by': sa})

        # 2. Create 20 Operators (Booths)
        operators = []
        for i in range(1, 21):
            booth_id = f"Booth {i:03d}"
            # Cleanup duplicates first to avoid MultipleObjectsReturned
            existing_ops = Operator.objects.filter(booth_id=booth_id)
            if existing_ops.count() > 1:
                self.stdout.write(f'Cleaning up duplicates for {booth_id}...')
                existing_ops.delete() # Hard reset for duplicates

            op, created = Operator.objects.get_or_create(
                booth_id=booth_id,
                defaults={
                    'email': f"op{i}@janmat.com",
                    'password': make_password('123'),
                    'name': f"Operator {i}",
                    'created_by': admin,
                    'is_active': random.choice([True, True, True, False]) # 75% active
                }
            )
            operators.append(op)
        self.stdout.write(f'Ensured {len(operators)} Operators')

        # 3. Create Smart Fraud Logs & Voters (Linked)
        fraud_types = ['duplicate_biometric', 'multiple_otp_attempts', 'already_voted', 'invalid_session', 'suspicious_activity']
        
        # Helper to create a linked voter
        def ensure_fraud_voter(aadhaar, name, voted=False):
            v, _ = Voter.objects.get_or_create(
                aadhaar_number=aadhaar,
                admin_id=admin.id,
                defaults={
                    'full_name': name,
                    'date_of_birth': "1990-01-01",
                    'gender': random.choice(['Male', 'Female']),
                    'has_voted': voted,
                    'full_address': "123 Demo St, New Delhi",
                    # Photo will be created if missing, using placeholder URL for now if needed or left blank
                    'photo_url': f"https://api.dicebear.com/7.x/avataaars/svg?seed={aadhaar}"
                }
            )
            return v
            # Ensure voter exists for each fraud log
        for i in range(50):
            op = random.choice(operators)
            f_type = random.choice(fraud_types)
            is_reviewed = random.choice([True, False])
            
            # Generate a consistent Aadhaar for this log entry
            aadhaar = f"{random.randint(100000000000, 999999999999)}"
            
            # For 'already_voted', ensure the voter exists and has marked voted
            if f_type == 'already_voted':
                 ensure_fraud_voter(aadhaar, f"Fraudster {i}", voted=True)
            else:
                 # Randomly create backing voter for 50% of other frauds to show profile
                 if random.choice([True, False]):
                     ensure_fraud_voter(aadhaar, f"Suspect {i}")

            log = FraudLog.objects.create(
                fraud_type=f_type,
                aadhaar_number=aadhaar,
                booth_number=op.booth_id,
                details={'reason': f'System detected {f_type} during scan.'},
                operator=op,
                admin=admin,
                reviewed=is_reviewed,
            )
            # Hack to backdate
            log.flagged_at = timezone.now() - timedelta(hours=random.randint(0, 48), minutes=random.randint(0,60))
            log.save()
            
        self.stdout.write('Created 50 Fraud Logs')

        # 5. Create 100 Voters with distributed timestamps (for charts)
        # We want data for 30 days, 7 days, and 24 hours
        count_voters = Voter.objects.count()
        if count_voters < 100:
            self.stdout.write('Seeding distributed voters for charts...')
            for i in range(100):
                # Random time within last 30 days
                days_ago = random.randint(0, 30)
                # Random hour
                hours_ago = random.randint(0, 23)
                fake_time = timezone.now() - timedelta(days=days_ago, hours=hours_ago)
                
                is_verified = random.choice([True, True, False]) # 66% verified
                
                Voter.objects.create(
                    aadhaar_number=f"{random.randint(100000000000, 999999999999)}",
                    full_name=f"Voter {i}",
                    date_of_birth="1995-01-01",
                    gender=random.choice(['Male', 'Female']),
                    admin_id=admin.id,
                    verified_at=fake_time if is_verified else None,
                    has_voted=False
                )

        # 6. Create Audit Logs
        actions = ['login', 'logout', 'otp_sent', 'admin_action', 'operator_created']
        for i in range(30):
            action = random.choice(actions)
            AuditLog.objects.create(
                action=action,
                user_type='admin',
                user_id=admin.id,
                admin=admin,
                details={'info': f'Demo action {action}'},
                ip_address='127.0.0.1'
            )
        self.stdout.write('Seeded Audit Logs')
        
        self.stdout.write(self.style.SUCCESS('Database populated with ~50 records each!'))
