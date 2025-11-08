from flask import Blueprint, request, jsonify
from models.user import User
from models.bank import Bank
from models.block import Block
from models.encrypted_key import EncryptedKey
from services.encryption_service import kdf_key, decrypt_dek_for_party, decrypt_json_with_dek

decrypt_bp = Blueprint('decrypt', __name__)

@decrypt_bp.post('/loan/<loan_id>/decrypt/for-user')
def decrypt_for_user(loan_id):
    body = request.json
    user_name = body.get('userName')
    password = body.get('password')

    user = User.query.filter_by(user_name=user_name).first()
    enc = EncryptedKey.query.filter_by(loan_id=loan_id).first()
    block = Block.query.filter_by(loan_id=loan_id).order_by(Block.created_at.asc()).first()  # genesis metadata
    if not user or not enc or not block:
        return jsonify({"error": "Not found"}), 404

    user_key = kdf_key(password, user.salt)
    dek = decrypt_dek_for_party(enc.dek_cipher_for_user, enc.dek_nonce_for_user, user_key)
    plaintext = decrypt_json_with_dek(block.metadata_ciphertext, block.metadata_nonce, dek)
    return jsonify({"metadata": plaintext})

@decrypt_bp.post('/loan/<loan_id>/decrypt/for-bank')
def decrypt_for_bank(loan_id):
    body = request.json
    bank_id = body.get('bankId')
    bank_password = body.get('bankPassword')

    bank = Bank.query.filter_by(bank_id=bank_id).first()
    enc = EncryptedKey.query.filter_by(loan_id=loan_id).first()
    block = Block.query.filter_by(loan_id=loan_id).order_by(Block.created_at.asc()).first()
    if not bank or not enc or not block:
        return jsonify({"error": "Not found"}), 404

    bank_key = kdf_key(bank_password, bank.salt)
    dek = decrypt_dek_for_party(enc.dek_cipher_for_bank, enc.dek_nonce_for_bank, bank_key)
    plaintext = decrypt_json_with_dek(block.metadata_ciphertext, block.metadata_nonce, dek)
    return jsonify({"metadata": plaintext})