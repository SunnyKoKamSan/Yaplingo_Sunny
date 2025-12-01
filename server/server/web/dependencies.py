from typing import Annotated

import jwt
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from ulid import ULID

from server.repository.models import User
from server.service import Service as _Service
from server.web.settings import settings


async def service(request: Request) -> _Service:
    return request.app.state.service


Service = Annotated[_Service, Depends(service)]


async def current_user(
    credentials: Annotated[
        HTTPAuthorizationCredentials | None,
        Depends(HTTPBearer(auto_error=False)),
    ],
    service: Service,
) -> User:
    if credentials is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN)
    try:
        claims: dict[str, str] = jwt.decode(
            credentials.credentials,
            settings.secret,
            algorithms=["HS256"],
        )
    except jwt.PyJWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid Token")
    if (uid := claims.get("sub")) is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid Token")
    if (user := await service.user.get(ULID.from_str(uid))) is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User Not Found")
    return user
