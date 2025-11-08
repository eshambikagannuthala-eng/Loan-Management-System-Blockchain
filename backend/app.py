import os
import uuid
import base64
import random
import datetime
from typing import Optional

from flask import Flask, request, jsonify
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS

import bcrypt
import hashlib
import jwt
# Removed Header and HTTPException from flask/fastapi mix, not needed for this implementation
# from fastapi import Header
# from fastapi import HTTPException

from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.ciphers.aead import AESGCM


# ------------------------------------------------------------------------------
# Config
# ------------------------------------------------------------------------------
class Config:
    SQLALCHEMY_DATABASE_URI = os.getenv(
        "DB_URI",
        "mysql+pymysql://root:root@localhost:3306/loan_chain"
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    JWT_SECRET = os.getenv("JWT_SECRET", "dev-secret-change-me")
    APP_HASH_SALT = os.getenv("APP_HASH_SALT", "app-wide-hash-salt")
    CORS_ORIGINS = os.getenv("CORS_ORIGINS", "*")

# BANK_SESSIONS and require_bank are removed as they are not used in Flask/SQLAlchemy context here

app = Flask(__name__)
app.config.from_object(Config)
db = SQLAlchemy(app)
CORS(app, resources={r"/*": {"origins": app.config["CORS_ORIGINS"]}})


# ------------------------------------------------------------------------------
# Models
# ------------------------------------------------------------------------------
class User(db.Model):
    __tablename__ = "users"
    id = db.Column(db.Integer, primary_key=True)
    user_name = db.Column(db.String(80), unique=True, nullable=False)
    password_hash = db.Column(db.String(200), nullable=False)
    # KDF salt for envelope encryption (distinct from bcrypt's internal salt)
    salt = db.Column(db.LargeBinary, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)


class Bank(db.Model):
    __tablename__ = "banks"
    id = db.Column(db.Integer, primary_key=True)
    bank_id = db.Column(db.String(80), unique=True, nullable=False)
    bank_name = db.Column(db.String(120), nullable=False)
    bank_password_hash = db.Column(db.String(200), nullable=False)
    salt = db.Column(db.LargeBinary, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)


class Agent(db.Model):
    __tablename__ = "agents"
    id = db.Column(db.Integer, primary_key=True)
    agent_id = db.Column(db.String(80), unique=True, nullable=False)
    agent_name = db.Column(db.String(120), nullable=False)


class Block(db.Model):
    __tablename__ = "blockchain_blocks"
    id = db.Column(db.Integer, primary_key=True)

    loan_id = db.Column(db.String(64), nullable=False, index=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    bank_id = db.Column(db.Integer, db.ForeignKey("banks.id"), nullable=False)
    agent_id = db.Column(db.Integer, db.ForeignKey("agents.id"), nullable=True)

    # Encrypted metadata JSON (base64 text)
    metadata_ciphertext = db.Column(db.Text, nullable=False)
    metadata_nonce = db.Column(db.LargeBinary, nullable=False)

    transaction_data = db.Column(db.String(32), nullable=False) # initiated/accepted/paid/unpaid/completed/closed
    previous_hash = db.Column(db.String(64), nullable=False) # SHA-256 hex
    current_hash = db.Column(db.String(64), nullable=False) # SHA-256 hex

    # Public-only display (verification demo)
    bank_name_public = db.Column(db.String(120), nullable=True)

    created_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)
    updated_at = db.Column(
        db.DateTime,
        default=datetime.datetime.utcnow,
        onupdate=datetime.datetime.utcnow
    )


class EncryptedKey(db.Model):
    __tablename__ = "encrypted_keys"
    id = db.Column(db.Integer, primary_key=True)
    loan_id = db.Column(db.String(64), unique=True, nullable=False)

    # DEK (data-encryption key) encrypted for user & bank
    dek_cipher_for_user = db.Column(db.LargeBinary, nullable=False)
    dek_nonce_for_user = db.Column(db.LargeBinary, nullable=False)

    dek_cipher_for_bank = db.Column(db.LargeBinary, nullable=False)
    dek_nonce_for_bank = db.Column(db.LargeBinary, nullable=False)

    created_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)


# ------------------------------------------------------------------------------
# Crypto Utilities (Envelope Encryption)
# ------------------------------------------------------------------------------
def kdf_key(password: str, salt: bytes, iterations: int = 200_000) -> bytes:
    """
    Derive a 256-bit key from password using PBKDF2-HMAC-SHA256.
    """
    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(),
        length=32,
        salt=salt,
        iterations=iterations
    )
    return kdf.derive(password.encode("utf-8"))


def encrypt_json_with_dek(json_text: str, dek: bytes):
    """
    Encrypt plaintext JSON string with DEK using AES-256-GCM.
    Returns (cipher_b64, nonce_bytes).
    """
    nonce = os.urandom(12)  # AES-GCM nonce
    aesgcm = AESGCM(dek)
    ct = aesgcm.encrypt(nonce, json_text.encode("utf-8"), None)
    return base64.b64encode(ct).decode("utf-8"), nonce


def decrypt_json_with_dek(cipher_b64: str, nonce: bytes, dek: bytes) -> str:
    aesgcm = AESGCM(dek)
    ct = base64.b64decode(cipher_b64.encode("utf-8"))
    pt = aesgcm.decrypt(nonce, ct, None)
    return pt.decode("utf-8")


def encrypt_dek_for_party(dek: bytes, party_key: bytes):
    """
    Encrypt raw DEK using the party's derived key.
    """
    nonce = os.urandom(12)
    aesgcm = AESGCM(party_key)
    ct = aesgcm.encrypt(nonce, dek, None)
    return ct, nonce


def decrypt_dek_for_party(cipher: bytes, nonce: bytes, party_key: bytes) -> bytes:
    aesgcm = AESGCM(party_key)
    return aesgcm.decrypt(nonce, cipher, None)


# ------------------------------------------------------------------------------
# Blockchain Helpers
# ------------------------------------------------------------------------------
def compute_block_hash(
    metadata_cipher_b64: str,
    transaction_data: str,
    previous_hash: str,
    loan_id: str,
    nonce_hex: str,
    timestamp_iso: str,
    app_salt: str
) -> str:
    """
    Compute SHA-256 over a deterministic payload.
    """
    payload = "|".join([
        metadata_cipher_b64,
        transaction_data,
        previous_hash,
        loan_id,
        nonce_hex,
        timestamp_iso,
        app_salt
    ])
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def pick_random_agent() -> Optional[Agent]:
    agents = Agent.query.all()
    if not agents:
        return None
    return random.choice(agents)


def create_genesis_block(
    user: User,
    bank: Bank,
    agent: Optional[Agent],
    metadata_json_text: str,
    user_password: str,
    bank_password: str
):
    """
    - Generate DEK
    - Encrypt metadata with DEK
    - Encrypt DEK for User and Bank (envelope)
    - Create genesis block with transaction_data='initiated'
    """
    loan_id = uuid.uuid4().hex[:16]

    # Generate random DEK
    dek = os.urandom(32)

    # Encrypt metadata JSON
    metadata_cipher_b64, metadata_nonce = encrypt_json_with_dek(metadata_json_text, dek)

    # Envelope: encrypt DEK for both parties
    user_key = kdf_key(user_password, user.salt)
    bank_key = kdf_key(bank_password, bank.salt)

    dek_cipher_user, dek_nonce_user = encrypt_dek_for_party(dek, user_key)
    dek_cipher_bank, dek_nonce_bank = encrypt_dek_for_party(dek, bank_key)

    enc = EncryptedKey(
        loan_id=loan_id,
        dek_cipher_for_user=dek_cipher_user,
        dek_nonce_for_user=dek_nonce_user,
        dek_cipher_for_bank=dek_cipher_bank,
        dek_nonce_for_bank=dek_nonce_bank
    )
    db.session.add(enc)

    previous_hash = "0" * 64
    now_iso = datetime.datetime.utcnow().isoformat()
    nonce_hex = metadata_nonce.hex()
    block_hash = compute_block_hash(
        metadata_cipher_b64,
        "initiated",
        previous_hash,
        loan_id,
        nonce_hex,
        now_iso,
        app.config["APP_HASH_SALT"]
    )

    block = Block(
        loan_id=loan_id,
        user_id=user.id,
        bank_id=bank.id,
        agent_id=agent.id if agent else None,
        metadata_ciphertext=metadata_cipher_b64,
        metadata_nonce=metadata_nonce,
        transaction_data="initiated",
        previous_hash=previous_hash,
        current_hash=block_hash,
        bank_name_public=bank.bank_name
    )
    db.session.add(block)
    db.session.commit()

    return loan_id, block


def append_status_block(loan_id: str, new_status: str) -> Block:
    """
    Append a new block with updated transaction status.
    Metadata is carried forward to maintain chain integrity.
    """
    last_block = Block.query.filter_by(loan_id=loan_id).order_by(Block.created_at.desc()).first()
    if not last_block:
        raise ValueError("Loan not found")

    previous_hash = last_block.current_hash
    metadata_cipher_b64 = last_block.metadata_ciphertext
    metadata_nonce = last_block.metadata_nonce

    now_iso = datetime.datetime.utcnow().isoformat()
    nonce_hex = metadata_nonce.hex()
    block_hash = compute_block_hash(
        metadata_cipher_b64,
        new_status,
        previous_hash,
        loan_id,
        nonce_hex,
        now_iso,
        app.config["APP_HASH_SALT"]
    )

    block = Block(
        loan_id=loan_id,
        user_id=last_block.user_id,
        bank_id=last_block.bank_id,
        agent_id=last_block.agent_id,
        metadata_ciphertext=metadata_cipher_b64,
        metadata_nonce=metadata_nonce,
        transaction_data=new_status,
        previous_hash=previous_hash,
        current_hash=block_hash,
        bank_name_public=last_block.bank_name_public
    )
    db.session.add(block)
    db.session.commit()
    return block


# ------------------------------------------------------------------------------
# Utilities
# ------------------------------------------------------------------------------
def make_jwt(subject: str, role: str) -> str:
    payload = {
        "sub": subject,
        "role": role,
        "iat": int(datetime.datetime.utcnow().timestamp()),
        "exp": int((datetime.datetime.utcnow() + datetime.timedelta(hours=8)).timestamp())
    }
    return jwt.encode(payload, app.config["JWT_SECRET"], algorithm="HS256")


# ------------------------------------------------------------------------------
# Routes
# ------------------------------------------------------------------------------
@app.get("/health")
def health():
    return jsonify({"status": "ok", "time": datetime.datetime.utcnow().isoformat()})


# ---- Auth (Users) ------------------------------------------------------------
@app.post("/auth/register")
def register_user():
    body = request.json or {}
    user_name = body.get("userName")
    password = body.get("password")
    if not user_name or not password:
        return jsonify({"error": "userName and password required"}), 400

    if User.query.filter_by(user_name=user_name).first():
        return jsonify({"error": "User already exists"}), 400

    password_hash = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
    kdf_salt = os.urandom(16)

    user = User(user_name=user_name, password_hash=password_hash, salt=kdf_salt)
    db.session.add(user)
    db.session.commit()

    token = make_jwt(subject=user_name, role="user")
    return jsonify({"message": "User registered", "token": token})


@app.post("/auth/login")
def login_user():
    body = request.json or {}
    user_name = body.get("userName")
    password = body.get("password")
    if not user_name or not password:
        return jsonify({"error": "userName and password required"}), 400

    user = User.query.filter_by(user_name=user_name).first()
    if not user:
        return jsonify({"error": "Invalid credentials"}), 401

    if not bcrypt.checkpw(password.encode("utf-8"), user.password_hash.encode("utf-8")):
        return jsonify({"error": "Invalid credentials"}), 401

    token = make_jwt(subject=user_name, role="user")
    return jsonify({"message": "Login successful", "token": token})

@app.get("/loan/bank/<bank_id>")
def get_loans_for_bank(bank_id):
    """
    Retrieves the latest block for every loan associated with the given bank_id.
    Note: In a real app, this should be protected by a Bank JWT token.
    """
    bank = Bank.query.filter_by(bank_id=bank_id).first()
    if not bank:
        return jsonify({"error": "Bank not found"}), 404

    # Get all unique loan_ids associated with this bank
    loan_ids = db.session.query(Block.loan_id).filter_by(bank_id=bank.id).distinct().all()
    
    # Structure for the response
    loans_summary = []
    
    for (loan_id,) in loan_ids:
        # Get the LATEST block for each unique loan_id
        latest_block = Block.query.filter_by(loan_id=loan_id).order_by(Block.created_at.desc()).first()
        
        if latest_block:
            # We include just the essential, latest public data
            loans_summary.append({
                "loanId": latest_block.loan_id,
                "latestStatus": latest_block.transaction_data,
                "user": User.query.get(latest_block.user_id).user_name if latest_block.user_id else "N/A",
                "latestBlockHash": latest_block.current_hash,
                "initiatedAt": latest_block.created_at.isoformat()
            })

    return jsonify(loans_summary)


# ---- Banks -------------------------------------------------------------------
@app.post("/banks/register")
def register_bank():
    body = request.json or {}
    bank_id = body.get("bankId")
    bank_name = body.get("bankName")
    bank_password = body.get("bankPassword")
    if not bank_id or not bank_name or not bank_password:
        return jsonify({"error": "bankId, bankName, bankPassword required"}), 400

    if Bank.query.filter_by(bank_id=bank_id).first():
        return jsonify({"error": "Bank already exists"}), 400

    password_hash = bcrypt.hashpw(bank_password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
    kdf_salt = os.urandom(16)

    bank = Bank(
        bank_id=bank_id,
        bank_name=bank_name,
        bank_password_hash=password_hash,
        salt=kdf_salt
    )
    db.session.add(bank)
    db.session.commit()

    token = make_jwt(subject=bank_id, role="bank")
    return jsonify({"message": "Bank registered", "token": token})


@app.post("/banks/login")
def login_bank():
    body = request.json or {}
    bank_id = body.get("bankId")
    bank_password = body.get("bankPassword")
    if not bank_id or not bank_password:
        return jsonify({"error": "bankId and bankPassword required"}), 400

    bank = Bank.query.filter_by(bank_id=bank_id).first()
    if not bank:
        return jsonify({"error": "Invalid credentials"}), 401

    if not bcrypt.checkpw(bank_password.encode("utf-8"), bank.bank_password_hash.encode("utf-8")):
        return jsonify({"error": "Invalid credentials"}), 401

    # You could return a JWT here, but since the frontend only needs bankId for decrypt/transition 
    # and not for general auth, we'll just return success.
    # The bank ID is used directly in the frontend for transition/decryption API calls.
    return jsonify({"message": "Login successful", "bankId": bank.bank_id, "bankName": bank.bank_name})


@app.post("/loan/<loan_id>/close")
def loan_close_by_bank(loan_id):
    """
    Endpoint for a bank to transition a specific loan to the 'closed' status.
    Body: { "bankId": "..." }
    """
    body = request.json or {}
    bank_id_from_request = body.get("bankId")
    
    if not bank_id_from_request:
        return jsonify({"error": "bankId required in the request body"}), 400

    # 1. Verify the bank exists and is associated with the loan (using the genesis block)
    bank = Bank.query.filter_by(bank_id=bank_id_from_request).first()
    genesis = Block.query.filter_by(loan_id=loan_id).order_by(Block.created_at.asc()).first()

    if not bank or not genesis:
        return jsonify({"error": "Loan or Bank not found"}), 404

    if genesis.bank_id != bank.id:
        return jsonify({"error": "Unauthorized: Bank is not the initiator of this loan"}), 403

    # 2. Append the new status block using the existing helper function
    try:
        block = append_status_block(loan_id, "closed")
    except ValueError as e:
        return jsonify({"error": str(e)}), 404
    except Exception:
        return jsonify({"error": "Failed to close loan due to internal error"}), 500

    return jsonify({
        "message": f"Loan {loan_id} successfully transitioned to 'closed'.",
        "loanId": loan_id,
        "newStatus": block.transaction_data,
        "blockHash": block.current_hash
    })

@app.get("/banks/list")
def list_banks():
    banks = Bank.query.all()
    return jsonify([
        {"bankId": b.bank_id, "bankName": b.bank_name}
        for b in banks
    ])


# ---- Agents ------------------------------------------------------------------
@app.get("/agents/random")
def random_agent():
    agent = pick_random_agent()
    if not agent:
        return jsonify({"agent": None})
    return jsonify({"agent": {"id": agent.agent_id, "name": agent.agent_name}})


# ---- Loan & Blockchain -------------------------------------------------------
@app.post("/loan/initiate")
def loan_initiate():
    """
    Body:
    {
      "userName": "...",
      "bankId": "...",
      "metadataJson": "<JSON TEXT>",
      "userPassword": "...",   // used for user-side decryption
      "bankPassword": "..."    // used for bank-side decryption
    }
    """
    data = request.json or {}
    user_name = data.get("userName")
    bank_id = data.get("bankId")
    metadata_json = data.get("metadataJson")
    user_password = data.get("userPassword")
    bank_password = data.get("bankPassword")

    if not all([user_name, bank_id, metadata_json, user_password, bank_password]):
        return jsonify({"error": "Missing required fields"}), 400

    user = User.query.filter_by(user_name=user_name).first()
    bank = Bank.query.filter_by(bank_id=bank_id).first()
    if not user or not bank:
        return jsonify({"error": "User or Bank not found"}), 404

    agent = pick_random_agent()

    loan_id, block = create_genesis_block(
        user=user,
        bank=bank,
        agent=agent,
        metadata_json_text=metadata_json,
        user_password=user_password,
        bank_password=bank_password
    )

    return jsonify({
        "loanId": loan_id,
        "agent": {"id": agent.agent_id, "name": agent.agent_name} if agent else None,
        "blockHash": block.current_hash
    })


@app.post("/loan/<loan_id>/transition")
def loan_transition(loan_id):
    """
    Body: { "status": "accepted|paid|unpaid|completed|closed" }
    """
    body = request.json or {}
    status = body.get("status")
    # UPDATED: Added 'closed' as a valid transaction status
    valid = {"accepted", "paid", "unpaid", "completed", "closed"} 
    if status not in valid:
        return jsonify({"error": "Invalid status"}), 400

    try:
        block = append_status_block(loan_id, status)
    except ValueError as e:
        return jsonify({"error": str(e)}), 404

    return jsonify({"blockHash": block.current_hash, "status": block.transaction_data})


@app.get("/loan/<loan_id>")
def loan_chain(loan_id):
    print(f"Fetching blocks for loan ID: {loan_id}")
    blocks = Block.query.filter_by(loan_id=loan_id).order_by(Block.created_at.asc()).all()
    print(f"Found {len(blocks)} blocks")
    if not blocks:
        return jsonify([])

    result = []
    for b in blocks:
        result.append({
            "id": b.id,
            "loanId": b.loan_id,
            "transaction": b.transaction_data,
            "previousHash": b.previous_hash,
            "currentHash": b.current_hash,
            "bankName": b.bank_name_public,
            "metadata": {
                "ciphertext": b.metadata_ciphertext,    # encrypted, visible to all
                "nonceHex": b.metadata_nonce.hex()
            },
            "createdAt": b.created_at.isoformat()
        })
    return jsonify(result)

@app.get("/loan/block/<int:loanId>")
def loan_block(loanId):
    block = Block.query.get(loanId)
    if block:
        return jsonify({
            "id": block.id,
            "loanId": block.loan_id,
            "transaction": block.transaction_data,
            "previousHash": block.previous_hash,
            "currentHash": block.current_hash,
            "bankName": block.bank_name_public,
            "metadata": {
                "ciphertext": block.metadata_ciphertext,    # encrypted, visible to all
                "nonceHex": block.metadata_nonce.hex()
            },
            "createdAt": block.created_at.isoformat()
        })
    if not block:
        return jsonify({"error": "Block not found"}), 404

@app.get("/loan/full-chain")
def loan_full_chain():
    blocks = Block.query.order_by(Block.created_at.asc()).all()
    result = []
    for b in blocks:
        result.append({
            "id": b.id,
            "loanId": b.loan_id,
            "transaction": b.transaction_data,
            "previousHash": b.previous_hash,
            "currentHash": b.current_hash,
            "bankName": b.bank_name_public,
            "metadata": {
                "ciphertext": b.metadata_ciphertext,    # encrypted, visible to all
                "nonceHex": b.metadata_nonce.hex()
            },
            "createdAt": b.created_at.isoformat()
        })
    return jsonify(result)


# ---- Decrypt (with passwords) -----------------------------------------------
@app.post("/loan/<loan_id>/decrypt/for-user")
def decrypt_for_user(loan_id):
    """
    Body: { "userName": "...", "password": "..." }
    Returns plaintext metadata JSON (string) if correct.
    """
    body = request.json or {}
    user_name = body.get("userName")
    password = body.get("password")
    if not user_name or not password:
        return jsonify({"error": "userName and password required"}), 400

    user = User.query.filter_by(user_name=user_name).first()
    enc = EncryptedKey.query.filter_by(loan_id=loan_id).first()
    genesis = Block.query.filter_by(loan_id=loan_id).order_by(Block.created_at.asc()).first()
    if not user or not enc or not genesis:
        return jsonify({"error": "Not found"}), 404

    # Derive user key and decrypt DEK
    try:
        user_key = kdf_key(password, user.salt)
        dek = decrypt_dek_for_party(enc.dek_cipher_for_user, enc.dek_nonce_for_user, user_key)
        plaintext = decrypt_json_with_dek(genesis.metadata_ciphertext, genesis.metadata_nonce, dek)
    except Exception:
        return jsonify({"error": "Decryption failed"}), 401

    return jsonify({"metadata": plaintext})


@app.post("/loan/<loan_id>/decrypt/for-bank")
def decrypt_for_bank(loan_id):
    """
    Body: { "bankId": "...", "bankPassword": "..." }
    Returns plaintext metadata JSON (string) if correct.
    """
    body = request.json or {}
    bank_id = body.get("bankId")
    bank_password = body.get("bankPassword")
    if not bank_id or not bank_password:
        return jsonify({"error": "bankId and bankPassword required"}), 400

    bank = Bank.query.filter_by(bank_id=bank_id).first()
    enc = EncryptedKey.query.filter_by(loan_id=loan_id).first()
    genesis = Block.query.filter_by(loan_id=loan_id).order_by(Block.created_at.asc()).first()
    if not bank or not enc or not genesis:
        return jsonify({"error": "Not found"}), 404

    # Derive bank key and decrypt DEK
    try:
        bank_key = kdf_key(bank_password, bank.salt)
        dek = decrypt_dek_for_party(enc.dek_cipher_for_bank, enc.dek_nonce_for_bank, bank_key)
        plaintext = decrypt_json_with_dek(genesis.metadata_ciphertext, genesis.metadata_nonce, dek)
    except Exception:
        return jsonify({"error": "Decryption failed"}), 401

    return jsonify({"metadata": plaintext})


# ------------------------------------------------------------------------------
# Entrypoint
# ------------------------------------------------------------------------------
if __name__ == "__main__":
    # Ensure DB tables exist on startup (Flask 3.x safe)
    with app.app_context():
        db.create_all()
        # Initial check to add a default bank/agent if needed for testing the frontend
        # You'll likely need to manually add a Bank and an Agent to your DB for testing
        # e.g., using a SQL client or by adding temporary initialization logic here.
        
        # Example Initialization (Requires running once)
        # from sqlalchemy.exc import IntegrityError
        # try:
        #     # Bank (Example: bankId='bank-a', password='password')
        #     if not Bank.query.filter_by(bank_id='bank-a').first():
        #         password_hash = bcrypt.hashpw('password'.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
        #         kdf_salt = os.urandom(16)
        #         default_bank = Bank(bank_id='bank-a', bank_name='First National Bank', bank_password_hash=password_hash, salt=kdf_salt)
        #         db.session.add(default_bank)
        #         db.session.commit()
        #         print("Default Bank 'bank-a' added.")
        #     
        #     # Agent (Example: agent_id='agent-001')
        #     if not Agent.query.filter_by(agent_id='agent-001').first():
        #         default_agent = Agent(agent_id='agent-001', agent_name='Local Agent One')
        #         db.session.add(default_agent)
        #         db.session.commit()
        #         print("Default Agent 'agent-001' added.")
        # except IntegrityError:
        #     db.session.rollback()
        #     print("Default Bank/Agent already exists.")


    app.run(host="0.0.0.0", port=5000, debug=True)