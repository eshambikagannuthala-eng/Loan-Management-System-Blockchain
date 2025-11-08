from datetime import datetime
from db import db

class EncryptedKey(db.Model):
    __tablename__ = 'encrypted_keys'
    id = db.Column(db.Integer, primary_key=True)
    loan_id = db.Column(db.String(64), unique=True, nullable=False)

    dek_cipher_for_user = db.Column(db.LargeBinary, nullable=False)
    dek_nonce_for_user = db.Column(db.LargeBinary, nullable=False)

    dek_cipher_for_bank = db.Column(db.LargeBinary, nullable=False)
    dek_nonce_for_bank = db.Column(db.LargeBinary, nullable=False)

    created_at = db.Column(db.DateTime, default=datetime.utcnow)