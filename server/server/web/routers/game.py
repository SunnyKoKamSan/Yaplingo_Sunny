import asyncio

from fastapi import APIRouter

from ..dependencies import Service, User
from ..schemas.game import (
    AchievementsResponse,
    LeaderboardResponse,
    ShopResponse,
)

router = APIRouter()


@router.get("/leaderboard")
async def get_leaderboard(user: User, service: Service) -> LeaderboardResponse:
    (entries, my_entry) = await asyncio.gather(
        service.game.list_leaderboard(),
        service.game.get_leaderboard_user(user),
    )
    return LeaderboardResponse(me=my_entry, entries=entries)


@router.get("/achievements")
async def get_achievements(user: User, service: Service) -> AchievementsResponse.List:
    items = await service.game.get_user_achievements(user)
    return [AchievementsResponse.T(**item.model_dump()) for item in items]


@router.post("/achievements/claim/{key}")
async def claim_achievement(
    key: str,
    user: User,
    service: Service,
) -> None:
    await service.game.claim_user_achievement(user, key)


@router.get("/shop")
async def get_shop(user: User, service: Service) -> ShopResponse.List:
    items = await service.game.get_user_shop_items(user)
    return [ShopResponse.T(**item.model_dump()) for item in items]


@router.post("/shop/purchase/{key}")
async def purchase_shop_item(key: str, user: User, service: Service) -> None:
    await service.game.purchase_user_shop_item(user, key)


__all__ = ["router"]
