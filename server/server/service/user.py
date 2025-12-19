from typing import Annotated

from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError
from pydantic import BaseModel, Field
from ulid import ULID

from server.repository import Repository
from server.repository.models import Language, User
from server.store import Store


class UserCredentials(BaseModel):
    name: str
    password: str


class UserCreation(BaseModel):
    name: Annotated[str, Field(min_length=2, max_length=32, pattern=r"^[a-z0-9._]+$")]
    password: Annotated[str, Field(min_length=8, max_length=128)]
    language: Annotated[Language, Field()]


class UserService:
    hasher = PasswordHasher()

    def __init__(self, store: Store, repository: Repository):
        self.store = store
        self.repository = repository

    async def get(self, id: ULID) -> User | None:
        if (user := await self.store.user.get(id)) is None:
            return await self.repository.get_user(id)
        return user

    async def verify(self, credentials: UserCredentials) -> User | None:
        if (user := await self.repository.get_user(credentials.name)) is not None:
            try:
                self.hasher.verify(user.password, credentials.password)
            except VerifyMismatchError:
                return None
            return user

    async def create(self, creation: UserCreation) -> User:
        password = self.hasher.hash(creation.password)
        user = User(**creation.model_dump(exclude={"password"}), password=password)
        return await self.repository.create_user(user)


__all__ = ["UserService", "UserCredentials", "UserCreation"]
