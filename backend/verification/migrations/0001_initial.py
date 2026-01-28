# Generated initial migration for verification app

from django.db import migrations, models
import django.db.models.deletion
import uuid


class Migration(migrations.Migration):

    initial = True

    dependencies = [
    ]

    operations = [
        migrations.CreateModel(
            name='Voter',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('aadhaar_number', models.CharField(db_index=True, max_length=12)),
                ('full_name', models.CharField(max_length=255)),
                ('full_name_hindi', models.CharField(blank=True, max_length=255)),
                ('date_of_birth', models.DateField()),
                ('gender', models.CharField(choices=[('Male', 'Male'), ('Female', 'Female'), ('Other', 'Other')], max_length=10)),
                ('mobile_number', models.CharField(blank=True, max_length=15)),
                ('full_address', models.TextField(blank=True)),
                ('photo_base64', models.TextField(blank=True)),
                ('photo_url', models.URLField(blank=True, max_length=500)),
                ('verified_at', models.DateTimeField(blank=True, null=True)),
                ('has_voted', models.BooleanField(default=False)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('admin_id', models.UUIDField(db_index=True)),
                ('operator_id', models.UUIDField(blank=True, null=True)),
            ],
            options={
                'db_table': 'voters',
            },
        ),
        migrations.CreateModel(
            name='OTPCode',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('aadhaar_number', models.CharField(db_index=True, max_length=12)),
                ('otp_code', models.CharField(blank=True, max_length=6)),
                ('reference_id', models.CharField(blank=True, max_length=255)),
                ('expires_at', models.DateTimeField()),
                ('attempts', models.IntegerField(default=0)),
                ('is_used', models.BooleanField(default=False)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('admin_id', models.UUIDField(db_index=True)),
            ],
            options={
                'db_table': 'otp_codes',
            },
        ),
        migrations.CreateModel(
            name='BiometricTemplate',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('template_hash', models.CharField(db_index=True, max_length=255)),
                ('scan_quality', models.IntegerField()),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('admin_id', models.UUIDField(db_index=True)),
                ('operator_id', models.UUIDField(blank=True, null=True)),
                ('voter_id', models.UUIDField()),
            ],
            options={
                'db_table': 'biometric_templates',
            },
        ),
        migrations.AddIndex(
            model_name='voter',
            index=models.Index(fields=['admin_id', 'aadhaar_number'], name='voters_admin_aadhaar_idx'),
        ),
        migrations.AddIndex(
            model_name='voter',
            index=models.Index(fields=['admin_id', 'has_voted'], name='voters_admin_voted_idx'),
        ),
        migrations.AddIndex(
            model_name='otpcode',
            index=models.Index(fields=['admin_id', 'aadhaar_number', 'expires_at'], name='otp_admin_aadhaar_exp_idx'),
        ),
        migrations.AddIndex(
            model_name='otpcode',
            index=models.Index(fields=['admin_id', 'reference_id'], name='otp_admin_ref_idx'),
        ),
        migrations.AddIndex(
            model_name='otpcode',
            index=models.Index(fields=['admin_id', 'is_used'], name='otp_admin_used_idx'),
        ),
        migrations.AddIndex(
            model_name='biometrictemplate',
            index=models.Index(fields=['admin_id', 'template_hash'], name='biometric_admin_hash_idx'),
        ),
        migrations.AlterUniqueTogether(
            name='voter',
            unique_together={('admin_id', 'aadhaar_number')},
        ),
        migrations.AlterUniqueTogether(
            name='biometrictemplate',
            unique_together={('admin_id', 'template_hash')},
        ),
    ]