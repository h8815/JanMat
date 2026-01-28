from django.http import JsonResponse
from django.utils import timezone

def health_check(request):
    """Health check endpoint for Docker and load balancers"""
    return JsonResponse({
        'status': 'healthy',
        'timestamp': timezone.now().isoformat(),
        'service': 'janmat-backend'
    })