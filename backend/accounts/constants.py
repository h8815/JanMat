class SystemRoles:
    ADMIN = 'ADMIN'
    OPERATOR = 'OPERATOR'
    SUPERUSER = 'SUPERUSER'

    CHOICES = [
        (ADMIN, 'Admin'),
        (OPERATOR, 'Operator'),
        (SUPERUSER, 'Superuser'),
    ]
