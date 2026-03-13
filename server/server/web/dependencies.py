from typing import Annotated, Any, TypeAlias, cast

import jwt
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPBearer
from pydantic import BaseModel, ValidationError
from sqlmodel.ext.asyncio.session import AsyncSession
from starlette.requests import HTTPConnection
from ulid import ULID

from server.models import User as _User
from server.service import Service as _Service

from .settings import settings


async def service(connection: HTTPConnection) -> _Service:
    return connection.app.state.service


Service = Annotated[_Service, Depends(service)]


async def _session_dep(request: Request) -> AsyncSession:
    svc: _Service = request.app.state.service
    async with svc._repository.session() as db_session:
        yield db_session


SessionDep: TypeAlias = Annotated[AsyncSession, Depends(_session_dep)]


class TokenClaims(BaseModel):
    sub: ULID


class BearerToken(HTTPBearer):
    def __init__(self):
        super().__init__(auto_error=False)

    async def __call__(self, connection: HTTPConnection) -> TokenClaims:  # ty:ignore[invalid-method-override]
        credentials = await super().__call__(cast(Request, connection))
        if credentials is None:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN)
        try:
            claims: dict[str, Any] = jwt.decode(
                credentials.credentials,
                settings.secret,
                algorithms=["HS256"],
            )
            return TokenClaims.model_validate(claims)
        except jwt.PyJWTError or ValidationError:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid Token")


async def user(
    claims: Annotated[
        TokenClaims,
        Depends(BearerToken()),
    ],
    service: Service,
) -> _User:
    if (user := await service.user.get(claims.sub)) is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User Not Found")
    return user


User = Annotated[_User, Depends(user)]


__all__ = ["Service", "SessionDep", "User"]
