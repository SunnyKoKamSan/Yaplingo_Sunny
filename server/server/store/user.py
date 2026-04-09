from datetime import datetime, timedelta
from typing import Awaitable, cast
from zoneinfo import ZoneInfo

from redis.asyncio import Redis

from server.core.models.common import Insights
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
        def insights(user: User) -> str:
            return f"user:{user.id}:insights"

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

    async def get_insights(self, user: User) -> Insights | None:
        key = UserStore.Key.insights(user)
        op = self._client.json().get(key)
        data = await cast(Awaitable[dict | None], op)
        if data is not None and data.keys() > {"summary"}:
            return Insights(**data)

    async def set_insights(self, user: User, insights: Insights) -> None:
        key = UserStore.Key.insights(user)
        pipe = self._client.pipeline()
        pipe.json().set(key, "$", insights.model_dump(mode="json"))
        pipe.expire(key, INSIGHTS_TTL)
        await pipe.execute()

    async def get_insights_summary(self, user: User) -> str | None:
        key = UserStore.Key.insights(user)
        op = self._client.json().get(key, "$.summary")
        data = await cast(Awaitable[list[str | None]], op)
        return data[0] if data and data[0] is not None else None

    async def set_insights_summary(self, user: User, summary: str) -> None:
        key = UserStore.Key.insights(user)
        op = self._client.json().set(key, "$.summary", summary)
        await cast(Awaitable, op)


__all__ = ["UserStore"]
