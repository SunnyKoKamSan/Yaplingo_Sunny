from pydantic import BaseModel

from server.service.game import AchievementStatus, LeaderboardEntry


class LeaderboardResponse(BaseModel):
    me: LeaderboardEntry
    entries: list[LeaderboardEntry]


class AchievementsResponse:
    T = AchievementStatus
    List = list[T]


class AchievementClaimResponse(AchievementStatus): ...


__all__ = ["LeaderboardResponse", "AchievementsResponse", "AchievementClaimResponse"]
