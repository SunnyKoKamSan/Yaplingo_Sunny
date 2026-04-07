from fastapi import APIRouter

from ..dependencies import Service, User
from ..schemas.game import LeaderboardResponse

router = APIRouter()


@router.get("/leaderboard")
async def leaderboard(user: User, service: Service) -> LeaderboardResponse:
    entries = await service.game.list_leaderboard()
    my_entry = await service.game.get_leaderboard_user(user)
    return LeaderboardResponse(me=my_entry, entries=entries)


__all__ = ["router"]
