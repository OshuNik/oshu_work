"""
Updated Credentials Masking - v2 with improved patterns
"""
import re
import logging
from typing import Dict, Any

logger = logging.getLogger(__name__)


class LogMasker:
    """Enhanced credentials masking"""
    
    PATTERNS = {
        'bearer_token': re.compile(r'Bearer\s+([a-zA-Z0-9._\-]+)', re.IGNORECASE),
        'api_key': re.compile(r'(["\']?api[_-]?key["\']?\s*[:=]\s*["\']?)([a-zA-Z0-9._\-]+)(["\']?)', re.IGNORECASE),
        'token': re.compile(r'(["\']?token["\']?\s*[:=]\s*["\']?)([a-zA-Z0-9._\-]{20,})(["\']?)', re.IGNORECASE),
        'password': re.compile(r'(["\']?(?:password|passwd|pwd)["\']?\s*[:=]\s*["\']?)([^\s"\']+)(["\']?)', re.IGNORECASE),
        'secret': re.compile(r'(["\']?secret["\']?\s*[:=]\s*["\']?)([^\s"\']+)(["\']?)', re.IGNORECASE),
        'supabase_key': re.compile(r'(supabase[._-]?anon[._-]?key|SUPABASE[._-]?ANON[._-]?KEY)\s*[:=]\s*["\']?([a-zA-Z0-9._\-]+)["\']?', re.IGNORECASE),
        'jwt': re.compile(r'(["\']?jwt["\']?\s*[:=]\s*["\']?)([a-zA-Z0-9._\-]+)(["\']?)', re.IGNORECASE),
        'bare_token': re.compile(r'(token|key|auth)\d+', re.IGNORECASE),
    }
    
    REDACTED_PLACEHOLDER = '***REDACTED***'
    
    @staticmethod
    def mask_credentials(text: str) -> str:
        """Masks all sensitive data in string"""
        if not isinstance(text, str):
            return text
        
        masked_text = text
        
        # Bearer tokens
        masked_text = LogMasker.PATTERNS['bearer_token'].sub(
            r'Bearer ' + LogMasker.REDACTED_PLACEHOLDER,
            masked_text
        )
        
        # Bare tokens like token123, key456
        masked_text = re.sub(
            LogMasker.PATTERNS['bare_token'],
            LogMasker.REDACTED_PLACEHOLDER,
            masked_text
        )
        
        # API keys with key=value or key:value format
        masked_text = re.sub(
            LogMasker.PATTERNS['api_key'],
            r'\1' + LogMasker.REDACTED_PLACEHOLDER + r'\3',
            masked_text
        )
        
        # Tokens with 20+ chars
        masked_text = re.sub(
            LogMasker.PATTERNS['token'],
            r'\1' + LogMasker.REDACTED_PLACEHOLDER + r'\3',
            masked_text
        )
        
        # Passwords
        masked_text = re.sub(
            LogMasker.PATTERNS['password'],
            r'\1' + LogMasker.REDACTED_PLACEHOLDER + r'\3',
            masked_text
        )
        
        # Secrets
        masked_text = re.sub(
            LogMasker.PATTERNS['secret'],
            r'\1' + LogMasker.REDACTED_PLACEHOLDER + r'\3',
            masked_text
        )
        
        # Supabase keys
        masked_text = re.sub(
            LogMasker.PATTERNS['supabase_key'],
            r'\1' + LogMasker.REDACTED_PLACEHOLDER,
            masked_text
        )
        
        # JWT tokens
        masked_text = re.sub(
            LogMasker.PATTERNS['jwt'],
            r'\1' + LogMasker.REDACTED_PLACEHOLDER + r'\3',
            masked_text
        )
        
        return masked_text
    
    @staticmethod
    def mask_dict(data: Dict[str, Any]) -> Dict[str, Any]:
        """Masks credentials in dictionary"""
        if not isinstance(data, dict):
            return data
        
        masked_data = {}
        
        for key, value in data.items():
            key_lower = key.lower()
            
            if any(sensitive in key_lower for sensitive in ['password', 'token', 'secret', 'key', 'auth']):
                if isinstance(value, str):
                    masked_data[key] = LogMasker.REDACTED_PLACEHOLDER
                elif isinstance(value, (list, tuple)):
                    masked_data[key] = [LogMasker.REDACTED_PLACEHOLDER if isinstance(v, str) else v for v in value]
                else:
                    masked_data[key] = value
            elif isinstance(value, dict):
                masked_data[key] = LogMasker.mask_dict(value)
            elif isinstance(value, str):
                masked_data[key] = LogMasker.mask_credentials(value)
            else:
                masked_data[key] = value
        
        return masked_data
