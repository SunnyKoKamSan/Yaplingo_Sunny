from pydantic import BaseModel

from server.service.game import AchievementStatus, LeaderboardEntry, ShopItem


class LeaderboardResponse(BaseModel):
    me: LeaderboardEntry
    entries: list[LeaderboardEntry]


class AchievementsResponse:
    T = AchievementStatus
    List = list[T]


class ShopResponse:
    T = ShopItem
    List = list[T]


__all__ = [
    "LeaderboardResponse",
    "AchievementsResponse",
    "ShopResponse",
]
