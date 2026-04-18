from pydantic import BaseModel

from server.service.game import LeaderboardEntry, UserStatistics


class LeaderboardResponse(BaseModel):
    me: LeaderboardEntry
    entries: list[LeaderboardEntry]


class UserStatisticsResponse(UserStatistics): ...


__all__ = ["LeaderboardResponse", "UserStatisticsResponse"]
