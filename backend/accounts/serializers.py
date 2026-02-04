from rest_framework import serializers
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from .models import SuperAdmin, Admin, Operator

class AdminLoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)

    def validate_email(self, value):
        return value.lower().strip()

class OperatorLoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)

    def validate_email(self, value):
        return value.lower().strip()

class ChangePasswordSerializer(serializers.Serializer):
    new_password = serializers.CharField(
        write_only=True, 
        min_length=12,
        error_messages={'min_length': 'Password must be at least 12 characters.'}
    )

    def validate_new_password(self, value):
        try:
            validate_password(value)
        except ValidationError as e:
            raise serializers.ValidationError(e.messages)
        return value

class AdminChangePasswordSerializer(serializers.Serializer):
    old_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(
        write_only=True, 
        min_length=12,
        error_messages={'min_length': 'Password must be at least 12 characters.'}
    )

    def validate_new_password(self, value):
        try:
            validate_password(value)
        except ValidationError as e:
            raise serializers.ValidationError(e.messages)
        return value

class CreateOperatorSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(
        write_only=True, 
        min_length=12,
        error_messages={'min_length': 'Password must be at least 12 characters.'}
    )
    booth_id = serializers.CharField(max_length=50)
    full_name = serializers.CharField(max_length=255, required=False, allow_blank=True)

    def validate_email(self, value):
        email = value.lower().strip()
        if Operator.objects.filter(email=email).exists():
            raise serializers.ValidationError("Operator with this email already exists.")
        return email

    def validate_password(self, value):
        try:
            validate_password(value)
        except ValidationError as e:
            raise serializers.ValidationError(e.messages)
        return value

class SuperAdminSerializer(serializers.ModelSerializer):
    role = serializers.SerializerMethodField()
    class Meta:
        model = SuperAdmin
        fields = ['id', 'email', 'name', 'role', 'created_at', 'last_login']
        read_only_fields = ['id', 'created_at', 'last_login']
    
    def get_role(self, obj):
        return 'SUPERUSER'

class AdminSerializer(serializers.ModelSerializer):
    role = serializers.SerializerMethodField()
    class Meta:
        model = Admin
        fields = ['id', 'email', 'name', 'role', 'created_at', 'last_login']
        read_only_fields = ['id', 'created_at', 'last_login']

    def get_role(self, obj):
        return 'ADMIN'

class OperatorSerializer(serializers.ModelSerializer):
    role = serializers.SerializerMethodField()
    full_name = serializers.CharField(source='name', required=False)
    
    class Meta:
        model = Operator
        fields = ['id', 'email', 'full_name', 'booth_id', 'role', 'must_change_password', 'is_active', 'created_at', 'last_login']
        read_only_fields = ['id', 'created_at', 'last_login', 'email'] # Email usually static, but name/booth editable

    def get_role(self, obj):
        return 'OPERATOR'
    
    def update(self, instance, validated_data):
        # Handle field mapping manually if needed, or use source
        if 'full_name' in validated_data:
            instance.name = validated_data.pop('full_name')
        return super().update(instance, validated_data)

    def get_role(self, obj):
        return 'OPERATOR'