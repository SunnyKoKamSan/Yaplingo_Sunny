from datetime import timedelta
from typing import Awaitable, cast

from redis.asyncio import Redis
from ulid import ULID

from server.repository.models import User

USER_TTL = timedelta(days=1)


class UserStore:
    def __init__(self, client: Redis):
        self._client = client

    async def dump(self, user: User) -> User:
        op = self._client.hsetex(
            f"user:{str(user.id)}",
            mapping=user.model_dump(mode="json"),
            ex=USER_TTL,
        )
        await cast(Awaitable[None], op)
        return user

    async def get(self, uid: ULID) -> User | None:
        op = self._client.hgetall(f"user:{str(uid)}")
        data = await cast(Awaitable[dict | None], op)
        return User(**data) if data else None


__all__ = ["UserStore"]
