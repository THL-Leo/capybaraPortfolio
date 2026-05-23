import base64
import hashlib
import os

from cryptography.fernet import Fernet


def _fernet_key_bytes() -> bytes:
    key = os.getenv('ENCRYPTION_KEY')
    if key:
        return key.encode('utf-8')
    secret = os.getenv('SECRET_KEY')
    if not secret:
        raise ValueError('Set ENCRYPTION_KEY or SECRET_KEY in .env')
    return base64.urlsafe_b64encode(hashlib.sha256(secret.encode()).digest())


def encrypt_token(plain: str) -> str:
    return Fernet(_fernet_key_bytes()).encrypt(plain.encode('utf-8')).decode('utf-8')


def decrypt_token(cipher: str) -> str:
    return Fernet(_fernet_key_bytes()).decrypt(cipher.encode('utf-8')).decode('utf-8')
