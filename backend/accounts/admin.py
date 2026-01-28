from django.contrib import admin
from django.contrib.auth.hashers import make_password
from .models import SuperAdmin, Admin, Operator

@admin.register(SuperAdmin)
class SuperAdminAdmin(admin.ModelAdmin):
    list_display = ('email', 'name', 'is_active', 'created_at')
    search_fields = ('email', 'name')
    
    def save_model(self, request, obj, form, change):
        if 'password' in form.cleaned_data:
            obj.password = make_password(form.cleaned_data['password'])
        super().save_model(request, obj, form, change)

@admin.register(Admin)
class AdminAdmin(admin.ModelAdmin):
    list_display = ('email', 'name', 'created_by', 'is_active')
    search_fields = ('email', 'name')
    list_filter = ('created_by',)
    
    def get_queryset(self, request):
        qs = super().get_queryset(request)
        # Isolation: Only show Admins created by this SuperAdmin
        if hasattr(request.user, 'super_admin_profile'):
            return qs.filter(created_by=request.user.super_admin_profile)
        return qs

    def save_model(self, request, obj, form, change):
        # Auto-assign created_by
        if not change and hasattr(request.user, 'super_admin_profile'):
            obj.created_by = request.user.super_admin_profile
            
        if 'password' in form.cleaned_data:
            obj.password = make_password(form.cleaned_data['password'])
        super().save_model(request, obj, form, change)

@admin.register(Operator)
class OperatorAdmin(admin.ModelAdmin):
    list_display = ('email', 'name', 'booth_id', 'created_by', 'is_active')
    search_fields = ('email', 'name', 'booth_id')
    list_filter = ('created_by', 'booth_id')
    
    def get_queryset(self, request):
        qs = super().get_queryset(request)
        # Isolation: Only show Operators belonging to Admins created by this SuperAdmin
        if hasattr(request.user, 'super_admin_profile'):
            return qs.filter(created_by__created_by=request.user.super_admin_profile)
        return qs
    
    def formfield_for_foreignkey(self, db_field, request, **kwargs):
        if db_field.name == "created_by":
             # Only allow assigning to Admins created by this SuperAdmin
             if hasattr(request.user, 'super_admin_profile'):
                 kwargs["queryset"] = Admin.objects.filter(created_by=request.user.super_admin_profile)
        return super().formfield_for_foreignkey(db_field, request, **kwargs)

    def save_model(self, request, obj, form, change):
        if 'password' in form.cleaned_data:
            obj.password = make_password(form.cleaned_data['password'])
        super().save_model(request, obj, form, change)