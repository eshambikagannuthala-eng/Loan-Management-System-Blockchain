from db import db

class Agent(db.Model):
    __tablename__ = 'agents'
    id = db.Column(db.Integer, primary_key=True)
    agent_id = db.Column(db.String(80), unique=True, nullable=False)
    agent_name = db.Column(db.String(120), nullable=False)