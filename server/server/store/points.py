from datetime import datetime, timedelta
from typing import Awaitable, cast
from zoneinfo import ZoneInfo

from redis.asyncio import Redis
from ulid import ULID

from server.repository.entities import User

POINTS_TTL = timedelta(days=1, hours=1)


class PointsStore:
    def __init__(self, client: Redis):
        self._client = client

    @staticmethod
    def key_today(user_uid: User | ULID) -> str:
        prefix = f"user:{str(user_uid.id if isinstance(user_uid, User) else user_uid)}"
        today = datetime.now(ZoneInfo("UTC")).date().strftime("%Y%m%d")
        return f"{prefix}:points:{today}"

    async def get_today(self, user: User) -> int | None:
        op = self._client.get(self.key_today(user))
        value = await cast(Awaitable[str | None], op)
        return int(value) if value is not None else None

    async def add_today(self, user: User, points_to_add: int) -> int:
        value = await self._client.incrby(self.key_today(user), points_to_add)
        await self._client.expire(self.key_today(user), POINTS_TTL, nx=True)
        return value


__all__ = ["PointsStore"]
