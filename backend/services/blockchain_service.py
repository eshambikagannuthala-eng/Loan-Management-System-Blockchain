import uuid, datetime
from models.block import Block
from models.encrypted_key import EncryptedKey
from models.bank import Bank
from models.user import User
from services.hashing_service import compute_block_hash
from services.encryption_service import (encrypt_json_with_dek, encrypt_dek_for_party, kdf_key)
from db import db
from flask import current_app

def create_genesis_block(user: User, bank: Bank, agent, metadata_json_text: str, user_password: str, bank_password: str):
    loan_id = uuid.uuid4().hex[:16]
    # Generate DEK
    import os
    dek = os.urandom(32)

    # Encrypt metadata
    metadata_cipher_b64, metadata_nonce = encrypt_json_with_dek(metadata_json_text, dek)

    # Envelope encrypt DEK for both parties
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

    # Build block
    previous_hash = "0" * 64
    now = datetime.datetime.utcnow().isoformat()
    nonce_hex = metadata_nonce.hex()
    block_hash = compute_block_hash(metadata_cipher_b64, "initiated", previous_hash, loan_id, nonce_hex, now, current_app.config['APP_HASH_SALT'])

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

def append_status_block(loan_id: str, new_status: str):
    # fetch last block
    last_block = Block.query.filter_by(loan_id=loan_id).order_by(Block.created_at.desc()).first()
    if not last_block:
        raise ValueError("Loan not found")

    previous_hash = last_block.current_hash
    # carry forward same metadata (immutability: you can re-encrypt with same DEK or store empty metadata if unchanged)
    metadata_cipher_b64 = last_block.metadata_ciphertext
    metadata_nonce = last_block.metadata_nonce
    now = datetime.datetime.utcnow().isoformat()
    nonce_hex = metadata_nonce.hex()

    block_hash = compute_block_hash(metadata_cipher_b64, new_status, previous_hash, loan_id, nonce_hex, now, current_app.config['APP_HASH_SALT'])

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