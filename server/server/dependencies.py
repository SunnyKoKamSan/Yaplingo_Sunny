from typing import Annotated

import jwt
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from server.core import Yaplingo as _Yaplingo
from server.repository import Repository as _Repository
from server.repository.models import User
from server.settings import settings


async def yaplingo(request: Request) -> _Yaplingo:
    return request.app.state.yaplingo


async def repository(request: Request) -> _Repository:
    return request.app.state.repository


Yaplingo = Annotated[_Yaplingo, Depends(yaplingo)]
Repository = Annotated[_Repository, Depends(repository)]

security = HTTPBearer(auto_error=False)  # handle errors ourselves
Credentials = Annotated[HTTPAuthorizationCredentials | None, Depends(security)]


async def current_user(credentials: Credentials, repository: Repository) -> User:
    if credentials is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN)
    try:
        claims = jwt.decode(credentials.credentials, settings.secret, algorithms=["HS256"])
    except jwt.PyJWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid Token")
    if (uid := claims.get("sub")) is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid Token")
    # TODO: cache this to avoid database hit on every protected endpoint
    if (user := await repository.get_user(uid)) is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User Not Found")
    return user
