from datetime import datetime, timedelta, timezone

import jwt
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
from ulid import ULID

from server.models import Language
from server.repository import EntityExistsError
from server.service.user import UserCreation, UserCredentials

from ..dependencies import Service, User
from ..settings import settings

TOKEN_TTL = timedelta(days=7)

router = APIRouter()


def generate_token(uid: ULID) -> str:
    expiration = datetime.now(timezone.utc) + TOKEN_TTL
    claims = {"sub": str(uid), "exp": expiration}
    return jwt.encode(claims, settings.secret, algorithm="HS256")


@router.post("/register", status_code=status.HTTP_201_CREATED)
async def register(creation: UserCreation, service: Service):
    try:
        user = await service.user.create(creation)
    except EntityExistsError:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="User Already Exists")
    return {"token": generate_token(user.id)}


@router.post("/login")
async def login(credentials: UserCredentials, service: Service):
    if (user := await service.user.verify(credentials)) is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)
    return {"token": generate_token(user.id)}


class UserResponse(BaseModel):
    id: ULID
    name: str
    language: Language


@router.get("/me", response_model=UserResponse)
async def me(user: User) -> User:
    return user


__all__ = ["router"]
