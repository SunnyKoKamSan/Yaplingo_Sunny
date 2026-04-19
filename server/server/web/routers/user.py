import asyncio
from typing import Literal

from fastapi import APIRouter, HTTPException, Response, status
from multiavatar.multiavatar import multiavatar
from ulid import ULID

from ..dependencies import Service, User
from ..schemas.user import UserInsightsResponse, UserResponse, UserStatisticsResponse

router = APIRouter()


@router.get("/{uid}.svg")
async def get_user_avatar(uid: ULID, service: Service):
    _user = await service.user.get(uid)
    if _user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User Not Found")
    svg = multiavatar(str(uid), None, None)
    return Response(content=svg, media_type="image/svg+xml")


@router.get("/{uid}")
async def get_user(uid: Literal["@"] | ULID, user: User, service: Service) -> UserResponse:
    if uid != "@":
        _user = await service.user.get(uid)
        if _user is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User Not Found")
        user = _user
    (today_points, activity, boost) = await asyncio.gather(
        service.game.get_user_today_points(user),
        service.game.get_user_year_activity(user),
        service.game.get_user_active_boost(user),
    )
    return UserResponse(
        **user.model_dump(exclude={"points"}),
        points=UserResponse.Points(
            today=today_points,
            total=user.points,
            milestone=user.streak_milestone,
        ),
        boost=UserResponse.Boost(
            multiplier=boost.multiplier,
            expiry=boost.expiry,
        )
        if boost
        else None,
        activity=activity,
    )


@router.get("/@/insights")
async def get_my_insights(user: User, service: Service) -> UserInsightsResponse | None:
    insights = await service.user.get_insights_with_summary(user)
    return UserInsightsResponse(**insights.model_dump()) if insights else None


@router.get("/@/stats")
async def stats(user: User, service: Service) -> UserStatisticsResponse:
    # if uid != user.id:
    #     _user = await service.user.get(uid)
    #     if _user is None:
    #         raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User Not Found")
    #     user = _user
    stats = await service.user.get_stats(user)
    return UserStatisticsResponse(**stats.model_dump())


__all__ = ["router"]
