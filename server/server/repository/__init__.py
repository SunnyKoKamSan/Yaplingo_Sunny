from typing import TYPE_CHECKING

from argon2 import PasswordHasher
from pydantic import PostgresDsn
from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlmodel import SQLModel
from sqlmodel.ext.asyncio.session import AsyncSession

from .echo import EchoRepository
from .user import UserRepository

if TYPE_CHECKING:
    cached_property = property
else:
    from functools import cached_property


class Settings(BaseSettings):
    url: PostgresDsn

    model_config = SettingsConfigDict(env_prefix="database_")


settings = Settings.model_validate({})


class Repository:
    _hasher = PasswordHasher()

    def __init__(self):
        self.engine = create_async_engine(str(settings.url), echo=False, future=True)
        self.session = async_sessionmaker(self.engine, class_=AsyncSession, expire_on_commit=False)

    @classmethod
    async def create(cls):
        self = cls()
        async with self.engine.begin() as conn:
            await conn.run_sync(SQLModel.metadata.create_all)
        return self

    async def dispose(self):
        await self.engine.dispose()

    @cached_property
    def user(self) -> UserRepository:
        return UserRepository(self.session)

    @cached_property
    def echo(self) -> EchoRepository:
        return EchoRepository(self.session)


__all__ = ["Repository"]
