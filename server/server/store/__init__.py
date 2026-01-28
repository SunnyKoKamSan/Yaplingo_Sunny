from typing import TYPE_CHECKING

from pydantic import RedisDsn
from pydantic_settings import BaseSettings, SettingsConfigDict
from redis.asyncio import Redis as AsyncRedis

from .echo import EchoStore
from .user import UserStore

if TYPE_CHECKING:
    cached_property = property
else:
    from functools import cached_property


class Settings(BaseSettings):
    url: RedisDsn

    model_config = SettingsConfigDict(env_prefix="store_")


settings = Settings.model_validate({})


class Store:
    def __init__(self):
        self.client = AsyncRedis.from_url(str(settings.url), decode_responses=True)

    @classmethod
    async def create(cls):
        return cls()

    async def dispose(self):
        await self.client.aclose()

    @cached_property
    def echo(self) -> EchoStore:
        return EchoStore(self.client)

    @cached_property
    def user(self) -> UserStore:
        return UserStore(self.client)


__all__ = ["Store"]
