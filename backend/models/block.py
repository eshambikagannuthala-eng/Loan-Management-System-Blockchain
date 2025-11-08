from datetime import datetime
from db import db

class Block(db.Model):
    __tablename__ = 'blockchain_blocks'
    id = db.Column(db.Integer, primary_key=True)
    loan_id = db.Column(db.String(64), nullable=False, index=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    bank_id = db.Column(db.Integer, db.ForeignKey('banks.id'), nullable=False)
    agent_id = db.Column(db.Integer, db.ForeignKey('agents.id'), nullable=True)

    metadata_ciphertext = db.Column(db.MEDIUMTEXT, nullable=False)  # base64 text
    metadata_nonce = db.Column(db.LargeBinary, nullable=False)

    transaction_data = db.Column(db.String(32), nullable=False)
    previous_hash = db.Column(db.String(64), nullable=False)
    current_hash = db.Column(db.String(64), nullable=False)
    bank_name_public = db.Column(db.String(120), nullable=True)

    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
