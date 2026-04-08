from pydantic import BaseModel

from server.service.game import AchievementStatus, AchievementUnlock, LeaderboardEntry


class LeaderboardResponse(BaseModel):
    me: LeaderboardEntry
    entries: list[LeaderboardEntry]


class AchievementResponse(AchievementStatus): ...


class AchievementClaimInput(BaseModel):
    achievement_key: str


class AchievementClaimResponse(AchievementUnlock): ...


__all__ = ["LeaderboardResponse", "AchievementResponse", "AchievementClaimInput", "AchievementClaimResponse"]
