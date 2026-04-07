from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from redis.asyncio import Redis

from server.repository.entities import User

POINTS_TTL = timedelta(days=1, hours=1)


class PointsStore:
    class Key:
        @staticmethod
        def today(user: User) -> str:
            tz = ZoneInfo(user.timezone)
            d = datetime.now(tz).date().strftime("%Y%m%d")
            return f"user:{user.id}:points:{d}"

    def __init__(self, client: Redis):
        self._client = client

    async def get_today(self, user: User) -> int | None:
        value = await self._client.get(PointsStore.Key.today(user))
        return int(value) if value is not None else None

    async def increment_today(self, user: User, points: int) -> int:
        key = PointsStore.Key.today(user)
        value = await self._client.incrby(key, points)
        await self._client.expire(key, POINTS_TTL, nx=True)
        return value


__all__ = ["PointsStore"]
