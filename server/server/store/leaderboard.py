from redis.asyncio import Redis
from ulid import ULID

from server.repository.entities import User


class LeaderboardStore:
    class Key:
        leaderboard = "leaderboard:xp"

    def __init__(self, client: Redis):
        self._client = client

    async def dump(self, entries: list[tuple[ULID, int]]) -> None:
        if mapping := {str(uid): points for uid, points in entries}:
            await self._client.zadd(LeaderboardStore.Key.leaderboard, mapping)

    async def increment(self, user: User, points: int) -> int:
        return int(await self._client.zincrby(LeaderboardStore.Key.leaderboard, points, str(user.id)))

    async def list(self, n: int = 50) -> list[tuple[ULID, int]]:
        results = await self._client.zrevrange(LeaderboardStore.Key.leaderboard, 0, n - 1, withscores=True)
        return [(ULID.from_str(uid), int(score)) for uid, score in results]

    async def get(self, user: User) -> tuple[int, int] | None:
        rank = await self._client.zrevrank(LeaderboardStore.Key.leaderboard, str(user.id))
        if rank is None:
            return None
        score = await self._client.zscore(LeaderboardStore.Key.leaderboard, str(user.id))
        if score is None:
            return None
        return (rank + 1, int(score))  # zrevrank is 0-based so add 1 for 1-based rank

    async def count(self) -> int:
        return await self._client.zcard(LeaderboardStore.Key.leaderboard)


__all__ = ["LeaderboardStore"]
