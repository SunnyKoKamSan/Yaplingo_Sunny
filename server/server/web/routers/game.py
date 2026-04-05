from fastapi import APIRouter

from ..dependencies import Service, User
from ..schemas.game import LeaderboardResponse

router = APIRouter()


@router.get("/leaderboard")
async def leaderboard(user: User, service: Service) -> LeaderboardResponse:
    leaderboard = await service.game.list_leaderboard()
    my_rank_score = await service.game.get_leaderboard_user(user)
    return LeaderboardResponse(
        entries=[
            LeaderboardResponse.Entry(
                uid=user.id,
                name=user.name,
                rank=rank,
                score=score,
            )
            for user, (rank, score) in leaderboard
        ],
        me=LeaderboardResponse.Entry(
            uid=user.id,
            name=user.name,
            rank=my_rank_score[0],
            score=my_rank_score[1],
        ),
    )


__all__ = ["router"]
