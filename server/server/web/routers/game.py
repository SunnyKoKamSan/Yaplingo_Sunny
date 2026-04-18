from fastapi import APIRouter

from ..dependencies import Service, User
from ..schemas.game import (
    AchievementClaimResponse,
    AchievementsResponse,
    LeaderboardResponse,
)

router = APIRouter()


@router.get("/leaderboard")
async def leaderboard(user: User, service: Service) -> LeaderboardResponse:
    entries = await service.game.list_leaderboard()
    my_entry = await service.game.get_leaderboard_user(user)
    return LeaderboardResponse(me=my_entry, entries=entries)


@router.get("/achievements")
async def achievements(user: User, service: Service) -> AchievementsResponse.List:
    items = await service.game.list_user_achievements(user)
    return [AchievementsResponse.T(**item.model_dump()) for item in items]


@router.post("/achievements/claim/{key}")
async def achievement_claim(
    key: str,
    user: User,
    service: Service,
) -> AchievementClaimResponse:
    claim = await service.game.claim_user_achievement(user, key)
    return AchievementClaimResponse(**claim.model_dump())


__all__ = ["router"]
