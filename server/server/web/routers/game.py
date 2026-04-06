from fastapi import APIRouter

from ..dependencies import Service, User
from ..schemas.game import LeaderboardResponse
from ...service.game import LeaderboardPeriod

router = APIRouter()


@router.get("/leaderboard")
async def leaderboard(
    user: User,
    service: Service,
    period: LeaderboardPeriod = "all-time",
) -> LeaderboardResponse:
    entries = await service.game.list_leaderboard(period=period)
    my_entry = await service.game.get_leaderboard_user(user, period=period)
    return LeaderboardResponse(me=my_entry, entries=entries)


__all__ = ["router"]
