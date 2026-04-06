import asyncio

from fastapi import APIRouter, HTTPException, status
from ulid import ULID

from ..dependencies import Service, User
from ..schemas.user import UserResponse

router = APIRouter()


@router.get("/{uid}")
async def get_user(uid: ULID, _user: User, service: Service) -> UserResponse:
    user = await service.user.get(uid, check_streak=False)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User Not Found")
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


@router.get("")
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
