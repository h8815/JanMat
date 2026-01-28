from django.core.management.base import BaseCommand
from django.contrib.auth.hashers import make_password
from django.utils import timezone
from accounts.models import SuperAdmin, Admin, Operator
from fraud.models import FraudLog
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

        # 3. Create 50 Fraud Logs
        # FraudLog.objects.filter(admin=admin).delete() # Optional: Clear old logs
        fraud_types = ['duplicate_biometric', 'multiple_otp_attempts', 'already_voted', 'invalid_session', 'suspicious_activity']
        
        for i in range(50):
            op = random.choice(operators)
            f_type = random.choice(fraud_types)
            is_reviewed = random.choice([True, False])
            
            log = FraudLog.objects.create(
                fraud_type=f_type,
                aadhaar_number=f"{random.randint(100000000000, 999999999999)}",
                booth_number=op.booth_id,
                details={'reason': f'System detected {f_type} during scan.'},
                operator=op,
                admin=admin,
                reviewed=is_reviewed,
                # flagged_at auto-sets to now. We can tweak it:
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
