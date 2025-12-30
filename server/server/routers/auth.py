from datetime import datetime, timedelta, timezone
from typing import Annotated

import jwt
from fastapi import APIRouter, Depends, HTTPException, status

from server.dependencies import Repository, current_user
from server.repository import EntityExistsError
from server.repository.models import User
from server.schemas import UserCreation, UserCredentials, UserResponse
from server.settings import settings

TOKEN_TTL = timedelta(days=7)

router = APIRouter()


def generate_token(user: User) -> str:
    expiration = datetime.now(timezone.utc) + TOKEN_TTL
    claims = {"sub": str(user.id), "exp": expiration}
    return jwt.encode(claims, settings.secret, algorithm="HS256")


@router.post("/register", status_code=status.HTTP_201_CREATED)
async def register(user_creation: UserCreation, repository: Repository):
    try:
        user = await repository.create_user(user_creation)
    except EntityExistsError:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="User Already Exists")
    return {"token": generate_token(user)}


@router.post("/login")
async def login(user_credentials: UserCredentials, repository: Repository):
    if (user := await repository.check_user(user_credentials)) is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)
    return {"token": generate_token(user)}


@router.get("/me", response_model=UserResponse)
async def me(current_user: Annotated[User, Depends(current_user)]) -> User:
    return current_user
