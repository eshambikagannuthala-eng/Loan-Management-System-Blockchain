from flask import Blueprint, request, jsonify
from models.user import User
from models.bank import Bank
from services.agent_service import pick_random_agent
from services.blockchain_service import create_genesis_block, append_status_block
from db import db

loan_bp = Blueprint('loan', __name__)

@loan_bp.post('/loan/initiate')
def initiate():
    data = request.json
    user_name = data.get('userName')
    bank_id = data.get('bankId')
    metadata_json = data.get('metadataJson')  # full JSON text as string
    user_password = data.get('userPassword')  # entered at apply time
    bank_password = data.get('bankPassword')  # for verification show

    user = User.query.filter_by(user_name=user_name).first()
    bank = Bank.query.filter_by(bank_id=bank_id).first()
    if not user or not bank:
        return jsonify({"error": "User or Bank not found"}), 400

    agent = pick_random_agent()
    loan_id, block = create_genesis_block(user, bank, agent, metadata_json, user_password, bank_password)

    return jsonify({"loanId": loan_id, "agent": {"id": agent.agent_id, "name": agent.agent_name} if agent else None, "blockHash": block.current_hash})

@loan_bp.post('/loan/<loan_id>/transition')
def transition(loan_id):
    data = request.json
    status = data.get('status')
    if status not in {"accepted", "paid", "unpaid", "completed"}:
        return jsonify({"error": "Invalid status"}), 400

    block = append_status_block(loan_id, status)
    return jsonify({"blockHash": block.current_hash, "status": block.transaction_data})

@loan_bp.get('/loan/<loan_id>/chain')
def chain(loan_id):
    from models.block import Block
    blocks = Block.query.filter_by(loan_id=loan_id).order_by(Block.created_at.asc()).all()
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
                "ciphertext": b.metadata_ciphertext,  # still encrypted
                "nonceHex": b.metadata_nonce.hex()
            },
            "createdAt": b.created_at.isoformat()
        })
    return jsonify(result)