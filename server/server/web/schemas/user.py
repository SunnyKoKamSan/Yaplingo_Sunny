from pydantic import BaseModel
from ulid import ULID

from server.repository.models import Language
from server.service.user import UserCreation, UserCredentials


class UserCreationInput(UserCreation): ...


class UserCredentialsInput(UserCredentials): ...


class UserResponse(BaseModel):
    id: ULID
    name: str
    language: Language


__all__ = ["UserResponse", "UserCreationInput", "UserCredentialsInput"]
