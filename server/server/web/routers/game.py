from fastapi import APIRouter, HTTPException, status

from ..dependencies import Service, User
from ..schemas.game import (
    AchievementClaimInput,
    AchievementClaimResponse,
    AchievementResponse,
    LeaderboardResponse,
)

router = APIRouter()


@router.get("/leaderboard")
async def leaderboard(user: User, service: Service) -> LeaderboardResponse:
    entries = await service.game.list_leaderboard()
    my_entry = await service.game.get_leaderboard_user(user)
    return LeaderboardResponse(me=my_entry, entries=entries)


@router.get("/achievements")
async def achievements(user: User, service: Service) -> list[AchievementResponse]:
    items = await service.game.list_achievements(user)
    return [AchievementResponse(**item.model_dump()) for item in items]


@router.post("/achievements/claim")
async def claim_achievement(
    payload: AchievementClaimInput,
    user: User,
    service: Service,
) -> AchievementClaimResponse:
    try:
        unlocked = await service.game.claim_achievement(user, payload.achievement_key)
    except (ValueError, PermissionError) as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        )
    return AchievementClaimResponse(**unlocked.model_dump())


__all__ = ["router"]
