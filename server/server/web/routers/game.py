import asyncio

from fastapi import APIRouter

from ..dependencies import Service, User
from ..schemas.game import LeaderboardResponse, UserStatisticsResponse

router = APIRouter()


@router.get("/leaderboard")
async def leaderboard(user: User, service: Service) -> LeaderboardResponse:
    (entries, my_entry) = await asyncio.gather(
        service.game.list_leaderboard(),
        service.game.get_leaderboard_user(user),
    )
    return LeaderboardResponse(me=my_entry, entries=entries)


@router.get("/stats")
async def stats(user: User, service: Service) -> UserStatisticsResponse:
    # if uid != user.id:
    #     _user = await service.user.get(uid)
    #     if _user is None:
    #         raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User Not Found")
    #     user = _user
    stats = await service.game.get_user_stats(user)
    return UserStatisticsResponse(**stats.model_dump())


__all__ = ["router"]
