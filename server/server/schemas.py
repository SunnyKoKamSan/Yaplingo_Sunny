from pydantic import BaseModel, Field
from ulid import ULID

from server.repository.models import Language


class UserCreation(BaseModel):
    name: str = Field(min_length=2, max_length=32, pattern=r"^[a-z0-9._]+$")
    password: str = Field(min_length=8, max_length=128)
    language: Language


class UserResponse(BaseModel):
    id: ULID
    name: str
    language: Language


class UserCredentials(BaseModel):
    name: str
    password: str
