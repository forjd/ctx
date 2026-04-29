from fastapi import APIRouter

router = APIRouter()


@router.get("/accounts")
def list_accounts():
    return []
