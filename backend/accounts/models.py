import uuid
from django.db import models
from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin

# --- DUMMY AUTH MODEL TO SATISFY DJANGO SETTINGS ---
class JanmatAuthUserManager(BaseUserManager):
    def create_user(self, email, password=None):
        user = self.model(email=email)
        user.set_password(password)
        user.save(using=self._db)
        return user
    def create_superuser(self, email, password=None):
        return self.create_user(email, password)

class JanmatAuthUser(AbstractBaseUser, PermissionsMixin):
    """
    Dummy user model to satisfy AUTH_USER_MODEL setting.
    Real authentication happens via specific tables below.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email = models.EmailField(unique=True)
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    is_superuser = models.BooleanField(default=False)
    
    objects = JanmatAuthUserManager()
    USERNAME_FIELD = 'email'
    
    class Meta:
        db_table = 'django_auth_users' # Separate table, rarely used

# --- ACTUAL ROLE MODELS ---

class AbstractJanmatActor(models.Model):
    """Base class for all system actors with common credentials"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email = models.EmailField(unique=True)
    password = models.CharField(max_length=128) # Stores hashed password
    name = models.CharField(max_length=255, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    last_login = models.DateTimeField(null=True, blank=True)

    class Meta:
        abstract = True

    @property
    def is_authenticated(self):
        return True

    @property
    def is_anonymous(self):
        return False

    def __str__(self):
        return f"{self.name} ({self.email})"

class SuperAdmin(AbstractJanmatActor):
    """Top-level Entity: Election Commission Officials"""
    class Meta:
        db_table = 'super_admins'
        verbose_name = 'Super Admin'

class Admin(AbstractJanmatActor):
    """Middle-level Entity: Tenant/District Admin"""
    # Linked to SuperAdmin who created/manages them
    created_by = models.ForeignKey(SuperAdmin, on_delete=models.SET_NULL, null=True, related_name='admins')
    
    class Meta:
        db_table = 'admins'
        verbose_name = 'Admin'

class Operator(AbstractJanmatActor):
    """Field-level Entity: Booth Operator"""
    booth_id = models.CharField(max_length=50)
    must_change_password = models.BooleanField(default=False)
    
    # Linked to Admin (Tenant) who created them
    created_by = models.ForeignKey(Admin, on_delete=models.CASCADE, related_name='operators')

    class Meta:
        db_table = 'operators'
        verbose_name = 'Operator'
        indexes = [
            models.Index(fields=['created_by', 'booth_id']),
        ]

    def __str__(self):
        return f"{self.name} - Booth {self.booth_id}"