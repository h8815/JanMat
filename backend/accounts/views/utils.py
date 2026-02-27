import string
import secrets
import re
from django.utils import timezone
from rest_framework.response import Response
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny

def get_shortform(text):
    if not text:
        return "xx"
    text = text.lower().strip()
    state_map = {
        'uttar pradesh': 'up', 'rajasthan': 'rj', 'maharashtra': 'mh',
        'madhya pradesh': 'mp', 'andhra pradesh': 'ap', 'arunachal pradesh': 'ar',
        'himachal pradesh': 'hp', 'west bengal': 'wb', 'tamil nadu': 'tn',
        'jammu and kashmir': 'jk',
    }
    if text in state_map: return state_map[text]
    words = re.findall(r'[a-z]+', text)
    if not words: return "xx"
    if len(words) == 1: return words[0][:3]
    return "".join(word[0] for word in words)[:3]

def generate_temp_password(length=12):
    alphabet = string.ascii_letters + string.digits + "!@#$%^&*"
    while True:
        pwd = ''.join(secrets.choice(alphabet) for i in range(length))
        if (any(c.islower() for c in pwd) and 
            any(c.isupper() for c in pwd) and 
            any(c.isdigit() for c in pwd) and 
            any(c in "!@#$%^&*" for c in pwd)):
            return pwd

@api_view(['GET'])
@permission_classes([AllowAny])
def health_check(request):
    return Response({'status': 'healthy', 'time': timezone.now().isoformat()})
