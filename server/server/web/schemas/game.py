from pydantic import BaseModel

from server.service.game import AchievementStatus, LeaderboardEntry, UserStatistics


class LeaderboardResponse(BaseModel):
    me: LeaderboardEntry
    entries: list[LeaderboardEntry]


class UserStatisticsResponse(UserStatistics): ...


class AchievementsResponse:
    T = AchievementStatus
    List = list[T]


class AchievementClaimResponse(AchievementStatus): ...


__all__ = ["LeaderboardResponse", "UserStatisticsResponse", "AchievementsResponse", "AchievementClaimResponse"]
