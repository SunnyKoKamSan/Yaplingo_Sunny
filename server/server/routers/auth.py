from datetime import datetime, timedelta, timezone
from typing import Annotated

import jwt
from fastapi import APIRouter, Depends, HTTPException, status

from server.dependencies import Repository, current_user
from server.repository.exceptions import EntityExistsError
from server.repository.models import User
from server.schemas import UserCreation, UserCredentials, UserResponse
from server.settings import settings

TOKEN_TTL = timedelta(days=7)

router = APIRouter()


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def register(user_creation: UserCreation, repository: Repository):
    try:
        user = repository.create_user(user_creation)
    except EntityExistsError:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="User Already Exists")
    return user


@router.post("/login")
def login(user_credentials: UserCredentials, repository: Repository):
    user = repository.check_user(user_credentials)
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)
    expiration = datetime.now(timezone.utc) + TOKEN_TTL
    claims = {"sub": str(user.id), "exp": expiration}
    return {"token": jwt.encode(claims, settings.secret, algorithm="HS256")}


@router.get("/me", response_model=UserResponse)
def me(current_user: Annotated[User, Depends(current_user)]) -> User:
    return current_user
