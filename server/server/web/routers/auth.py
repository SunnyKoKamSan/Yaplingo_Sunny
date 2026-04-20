from datetime import datetime, timedelta, timezone

import jwt
from fastapi import APIRouter, HTTPException, status
from ulid import ULID

from server.repository.exceptions import EntityExistsError

from ..dependencies import Service
from ..schemas.user import UserCreationInput, UserCredentialsInput
from ..settings import settings

TOKEN_TTL = timedelta(days=7)

router = APIRouter()


def generate_token(uid: ULID) -> str:
    expiration = datetime.now(timezone.utc) + TOKEN_TTL
    claims = {"sub": str(uid), "exp": expiration}
    return jwt.encode(claims, settings.secret.get_secret_value(), algorithm="HS256")


@router.post("/register", status_code=status.HTTP_201_CREATED)
async def register(creation: UserCreationInput, service: Service):
    try:
        user = await service.user.create(creation)
    except EntityExistsError:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="User Already Exists")
    return {"token": generate_token(user.id)}


@router.post("/login")
async def login(credentials: UserCredentialsInput, service: Service):
    if (user := await service.user.verify(credentials)) is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)
    return {"token": generate_token(user.id)}


__all__ = ["router"]
