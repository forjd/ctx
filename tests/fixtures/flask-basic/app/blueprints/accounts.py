from flask import Blueprint

accounts = Blueprint("accounts", __name__)


@accounts.get("/accounts")
def list_accounts():
    return []
