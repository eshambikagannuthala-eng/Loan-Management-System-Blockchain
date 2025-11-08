import hashlib

def compute_block_hash(metadata_cipher_b64: str, transaction_data: str, previous_hash: str, loan_id: str, nonce_hex: str, timestamp_iso: str, app_salt: str) -> str:
    payload = "|".join([metadata_cipher_b64, transaction_data, previous_hash, loan_id, nonce_hex, timestamp_iso, app_salt])
    return hashlib.sha256(payload.encode('utf-8')).hexdigest()