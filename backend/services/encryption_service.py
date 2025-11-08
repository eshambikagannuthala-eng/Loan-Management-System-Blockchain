import os, base64
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

def kdf_key(password: str, salt: bytes, iterations: int = 200_000) -> bytes:
    kdf = PBKDF2HMAC(algorithm=hashes.SHA256(), length=32, salt=salt, iterations=iterations)
    return kdf.derive(password.encode('utf-8'))

def encrypt_json_with_dek(json_text: str, dek: bytes):
    nonce = os.urandom(12)
    aesgcm = AESGCM(dek)
    ct = aesgcm.encrypt(nonce, json_text.encode('utf-8'), None)
    return base64.b64encode(ct).decode('utf-8'), nonce

def decrypt_json_with_dek(cipher_b64: str, nonce: bytes, dek: bytes) -> str:
    aesgcm = AESGCM(dek)
    ct = base64.b64decode(cipher_b64.encode('utf-8'))
    pt = aesgcm.decrypt(nonce, ct, None)
    return pt.decode('utf-8')

def encrypt_dek_for_party(dek: bytes, party_key: bytes):
    nonce = os.urandom(12)
    aesgcm = AESGCM(party_key)
    ct = aesgcm.encrypt(nonce, dek, None)
    return ct, nonce

def decrypt_dek_for_party(cipher: bytes, nonce: bytes, party_key: bytes) -> bytes:
    aesgcm = AESGCM(party_key)
    return aesgcm.decrypt(nonce, cipher, None)
