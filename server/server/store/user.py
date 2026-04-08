from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from redis.asyncio import Redis

from server.repository.entities import User

POINTS_TTL = timedelta(days=1, hours=1)
INSIGHTS_TTL = timedelta(days=1)


class UserStore:
    class Key:
        @staticmethod
        def points_today(user: User) -> str:
            tz = ZoneInfo(user.timezone)
            d = datetime.now(tz).date().strftime("%Y%m%d")
            return f"user:{user.id}:points:{d}"

        @staticmethod
        def insights_summary(user: User) -> str:
            return f"user:{user.id}:insights:summary"

    def __init__(self, client: Redis):
        self._client = client

    async def get_points_today(self, user: User) -> int | None:
        value = await self._client.get(UserStore.Key.points_today(user))
        return int(value) if value is not None else None

    async def increment_points_today(self, user: User, points: int) -> int:
        key = UserStore.Key.points_today(user)
        value = await self._client.incrby(key, points)
        await self._client.expire(key, POINTS_TTL, nx=True)
        return value

    async def get_insights_summary(self, user: User) -> str | None:
        return await self._client.get(UserStore.Key.insights_summary(user))

    async def set_insights_summary(self, user: User, summary: str) -> None:
        key = UserStore.Key.insights_summary(user)
        await self._client.set(key, summary, ex=INSIGHTS_TTL)


__all__ = ["UserStore"]
