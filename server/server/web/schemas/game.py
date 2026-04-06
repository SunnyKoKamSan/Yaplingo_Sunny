from pydantic import BaseModel

from server.service.game import LeaderboardEntry


class LeaderboardResponse(BaseModel):
    me: LeaderboardEntry
    entries: list[LeaderboardEntry]


__all__ = ["LeaderboardResponse"]
