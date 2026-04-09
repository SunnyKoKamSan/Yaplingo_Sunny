import asyncio

from fastapi import APIRouter, HTTPException, Response, status
from multiavatar.multiavatar import multiavatar
from ulid import ULID

from ..dependencies import Service, User
from ..schemas.user import UserInsightsResponse, UserResponse

router = APIRouter()


@router.get("/@")
async def get_me(user: User, service: Service) -> UserResponse:
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


@router.get("/{uid}.svg")
async def get_user_avatar(uid: ULID, service: Service):
    _user = await service.user.get(uid, check_streak=False)
    if _user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User Not Found")
    svg = multiavatar(str(uid), None, None)
    return Response(content=svg, media_type="image/svg+xml")


@router.get("/{uid}")
async def get_user(uid: ULID, user: User, service: Service) -> UserResponse:
    _user = await service.user.get(uid, check_streak=False)
    if _user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User Not Found")
    (today_points, activity) = await asyncio.gather(
        service.game.get_user_today_points(_user),
        service.game.get_user_year_activity(_user),
    )
    return UserResponse(
        **_user.model_dump(exclude={"points"}),
        milestone=_user.streak_milestone,
        points=(today_points, _user.points),
        activity=activity,
    )


@router.get("/@/insights")
async def get_my_insights(user: User, service: Service) -> UserInsightsResponse | None:
    insights = await service.user.get_insights_with_summary(user)
    return UserInsightsResponse(**insights.model_dump()) if insights else None


__all__ = ["router"]
