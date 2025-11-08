from datetime import datetime
from db import db

class Bank(db.Model):
    __tablename__ = 'banks'
    id = db.Column(db.Integer, primary_key=True)
    bank_id = db.Column(db.String(80), unique=True, nullable=False)
    bank_name = db.Column(db.String(120), nullable=False)
    bank_password_hash = db.Column(db.String(200), nullable=False)
    salt = db.Column(db.LargeBinary, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)