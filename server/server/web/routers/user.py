import asyncio

from fastapi import APIRouter

from ..dependencies import Service, User
from ..schemas.user import UserResponse

router = APIRouter()


@router.get("/me")
async def me(user: User, service: Service) -> UserResponse:
    (today_points, activity) = await asyncio.gather(
        service.game.get_user_today_points(user),
        service.game.get_user_year_activity(user),
    )
    return UserResponse(
        **user.model_dump(exclude={"points"}),
        milestone=user.streak_milestone,
        points=(today_points, user.points),
        activity=activity,
    )


__all__ = ["router"]
