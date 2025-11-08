import os

class Config:
    SQLALCHEMY_DATABASE_URI = "mysql+pymysql://root:root@localhost:3306/loan_chain"
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    JWT_SECRET = os.getenv("JWT_SECRET", "dev-secret-change-me")
    APP_HASH_SALT = os.getenv("APP_HASH_SALT", "app-wide-hash-salt")