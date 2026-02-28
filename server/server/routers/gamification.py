from datetime import datetime, timedelta, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.orm import selectinload

from server.core.gamification import get_period_key, get_visible_streak_utc, update_streak_utc
from server.dependencies import Repository, SessionDep, current_user
from server.repository.gamification import ACHIEVEMENTS, DailyAccuracy, DailyProgress, GEM_EARN_RATES, GEM_SPEND_RATES, GemBalance, GemTransaction, LeaderboardEntry, MasteryTier, TopicMastery, UserAchievement, UserGamification, UserInventory, XPMultiplierEvent
from server.repository.models import User
from server.schemas import AchievementResponse, ActiveEventResponse, CheckInRequest, CheckInResponse, ClaimAchievementRequest, ClaimAchievementResponse, GemBalanceResponse, GemConfigResponse, GemTransactionResponse, HistoryEntry, LeaderboardItem, MasteryConfigResponse, MyRankResponse, ProximityNeighbour, ProximityResponse, SpendGemsRequest, SpendGemsResponse, StatsResponse, TopicMasteryResponse, UserInventoryResponse
from server.utils import get_current_utc_period_key
from server.settings import settings as app_settings

router = APIRouter()

DAILY_GOAL_XP = 200
HIGH_ACCURACY_THRESHOLD = 80


@router.get("/active-events", response_model=list[ActiveEventResponse], status_code=status.HTTP_200_OK)
async def get_active_events(session: SessionDep) -> list[ActiveEventResponse]:
    """Return all currently active XP multiplier events. Public endpoint."""
    now = datetime.utcnow()
    result = await session.exec(
        select(XPMultiplierEvent).where(
            XPMultiplierEvent.is_active == True,
            XPMultiplierEvent.starts_at <= now,
            XPMultiplierEvent.ends_at >= now,
        )
    )
    rows = result.all()
    events = [r[0] if isinstance(r, tuple) or hasattr(r, "__getitem__") else r for r in rows]
    return events


@router.post("/check-in", response_model=CheckInResponse, status_code=status.HTTP_200_OK)
async def check_in(
    request: CheckInRequest,
    current_user: Annotated[User, Depends(current_user)],
    repository: Repository
) -> CheckInResponse:
    async with repository.session() as session:
        async with session.begin():
            try:
                # step 0: xp multiplier
                now_utc = datetime.utcnow()
                event_query = select(XPMultiplierEvent).where(
                    XPMultiplierEvent.is_active == True,
                    XPMultiplierEvent.starts_at <= now_utc,
                    XPMultiplierEvent.ends_at >= now_utc,
                )
                event_result = await session.exec(event_query)
                event_rows = event_result.all()
                active_event_row = event_rows[0] if event_rows else None
                active_event = (
                    active_event_row[0]
                    if active_event_row is not None and (isinstance(active_event_row, tuple) or hasattr(active_event_row, "__getitem__"))
                    else active_event_row
                )

                if active_event:
                    effective_xp = int(request.xp_amount * active_event.multiplier)
                    bonus_xp = effective_xp - request.xp_amount
                    event_name = active_event.name
                else:
                    effective_xp = request.xp_amount
                    bonus_xp = 0
                    event_name = None

                # step 1: server date
                today_utc = now_utc
                today_str = today_utc.strftime("%Y-%m-%d")
                today_date = today_utc.date()
                period_key = get_period_key(today_date)
                
                # step 2: daily progress
                query = select(DailyProgress).where(
                    DailyProgress.user_id == current_user.id,
                    DailyProgress.date_key == today_str
                )
                result = await session.exec(query)
                daily_progress_row = result.one_or_none()
                daily_progress = (
                    daily_progress_row[0]
                    if isinstance(daily_progress_row, tuple) or hasattr(daily_progress_row, "__getitem__")
                    else daily_progress_row
                )
                
                if daily_progress:
                    daily_progress.xp_earned += effective_xp
                    daily_progress.lessons_completed += 1
                else:
                    daily_progress = DailyProgress(
                        user_id=current_user.id,
                        date_key=today_str,
                        xp_earned=effective_xp,
                        lessons_completed=1,
                        goal_met=False
                    )
                    session.add(daily_progress)
                
                daily_progress.goal_met = daily_progress.xp_earned >= DAILY_GOAL_XP

                accuracy_query = select(DailyAccuracy).where(
                    DailyAccuracy.user_id == current_user.id,
                    DailyAccuracy.date_key == today_str,
                )
                accuracy_result = await session.exec(accuracy_query)
                accuracy_row = accuracy_result.one_or_none()
                daily_accuracy = (
                    accuracy_row[0]
                    if isinstance(accuracy_row, tuple) or hasattr(accuracy_row, "__getitem__")
                    else accuracy_row
                )

                is_high_accuracy = (
                    request.accuracy_percentage is not None
                    and request.accuracy_percentage >= HIGH_ACCURACY_THRESHOLD
                )

                if daily_accuracy:
                    if is_high_accuracy:
                        daily_accuracy.high_accuracy_hits += 1
                elif is_high_accuracy:
                    daily_accuracy = DailyAccuracy(
                        user_id=current_user.id,
                        date_key=today_str,
                        high_accuracy_hits=1,
                    )
                    session.add(daily_accuracy)
                
                # step 3: streak
                new_streak = await update_streak_utc(
                    session=session,
                    user_id=current_user.id,
                )
                
                # step 4: leaderboard
                leaderboard_entry = await session.get(
                    LeaderboardEntry,
                    (current_user.id, period_key)
                )
                
                if leaderboard_entry:
                    leaderboard_entry.total_xp += effective_xp
                else:
                    leaderboard_entry = LeaderboardEntry(
                        user_id=current_user.id,
                        period_key=period_key,
                        total_xp=effective_xp
                    )
                    session.add(leaderboard_entry)
                
                if request.topic:
                    topic_period_key = f"{period_key}::{request.topic}"
                    topic_entry = await session.get(
                        LeaderboardEntry,
                        (current_user.id, topic_period_key)
                    )
                    if topic_entry:
                        topic_entry.total_xp += effective_xp
                    else:
                        topic_entry = LeaderboardEntry(
                            user_id=current_user.id,
                            period_key=topic_period_key,
                            total_xp=effective_xp
                        )
                        session.add(topic_entry)
                
                # step 4.5: topic mastery
                old_mastery_tier = None
                if request.topic:
                    mastery_row = await session.get(
                        TopicMastery,
                        (current_user.id, request.topic),
                    )
                    acc = request.accuracy_percentage if request.accuracy_percentage is not None else 0
                    spd = request.completion_time_ms if request.completion_time_ms is not None else app_settings.MASTERY_SPEED_CEILING

                    if mastery_row:
                        old_mastery_tier = mastery_row.tier
                        new_count = mastery_row.lesson_count + 1
                        mastery_row.total_xp += effective_xp
                        mastery_row.lesson_count = new_count
                        mastery_row.avg_accuracy += (acc - mastery_row.avg_accuracy) / new_count
                        mastery_row.avg_speed_ms += (spd - mastery_row.avg_speed_ms) / new_count
                    else:
                        mastery_row = TopicMastery(
                            user_id=current_user.id,
                            topic=request.topic,
                            total_xp=effective_xp,
                            lesson_count=1,
                            avg_accuracy=float(acc),
                            avg_speed_ms=float(spd),
                        )
                        session.add(mastery_row)

                    # Recalculate mastery_score
                    norm_xp = min(mastery_row.total_xp / app_settings.MASTERY_XP_CEILING, 1.0)
                    speed_score = max(0.0, 1.0 - mastery_row.avg_speed_ms / app_settings.MASTERY_SPEED_CEILING)
                    acc_score = mastery_row.avg_accuracy / 100.0
                    mastery_row.mastery_score = (
                        app_settings.MASTERY_WEIGHT_XP * norm_xp
                        + app_settings.MASTERY_WEIGHT_ACC * acc_score
                        + app_settings.MASTERY_WEIGHT_SPD * speed_score
                    )

                    # Assign tier
                    s = mastery_row.mastery_score
                    if s >= app_settings.MASTERY_TIER_DIAMOND:
                        mastery_row.tier = MasteryTier.DIAMOND
                    elif s >= app_settings.MASTERY_TIER_PLATINUM:
                        mastery_row.tier = MasteryTier.PLATINUM
                    elif s >= app_settings.MASTERY_TIER_GOLD:
                        mastery_row.tier = MasteryTier.GOLD
                    elif s >= app_settings.MASTERY_TIER_SILVER:
                        mastery_row.tier = MasteryTier.SILVER
                    else:
                        mastery_row.tier = MasteryTier.BRONZE

                    mastery_row.updated_at = datetime.utcnow()
                
                # step 5: gem awards
                gems_earned_this_checkin = 0
                newly_unlocked: list[str] = []

                # Fetch or create GemBalance with FOR UPDATE lock
                gem_result = await session.exec(
                    select(GemBalance)
                    .where(GemBalance.user_id == current_user.id)
                    .with_for_update()
                )
                gem_row = gem_result.one_or_none()
                if gem_row and (isinstance(gem_row, tuple) or hasattr(gem_row, "__getitem__")):
                    gem_row = gem_row[0]
                if not gem_row:
                    gem_row = GemBalance(user_id=current_user.id, balance=0)
                    session.add(gem_row)

                def award_gems(amount: int, reason: str):
                    nonlocal gems_earned_this_checkin
                    gem_row.balance += amount
                    gems_earned_this_checkin += amount
                    session.add(GemTransaction(
                        user_id=current_user.id, amount=amount, reason=reason
                    ))

                was_goal_met_before = (daily_progress.xp_earned - effective_xp) >= DAILY_GOAL_XP
                if daily_progress.goal_met and not was_goal_met_before:
                    award_gems(GEM_EARN_RATES["daily_goal_met"], "daily_goal_met")

                if new_streak == 7:
                    award_gems(GEM_EARN_RATES["streak_7"], "streak_7")
                if new_streak == 30:
                    award_gems(GEM_EARN_RATES["streak_30"], "streak_30")

                if request.topic and mastery_row:
                    old_tier = old_mastery_tier
                    if old_tier is not None and mastery_row.tier != old_tier:
                        award_gems(GEM_EARN_RATES["mastery_tier_upgrade"], "mastery_tier_upgrade")

                # step 5.5: achievement evaluation
                existing_achievements_result = await session.exec(
                    select(UserAchievement.achievement_key)
                    .where(UserAchievement.user_id == current_user.id)
                )
                existing_keys = {
                    r[0] if isinstance(r, tuple) or hasattr(r, "__getitem__") else r
                    for r in existing_achievements_result.all()
                }

                lifetime_xp_result = await session.exec(
                    select(func.coalesce(func.sum(DailyProgress.xp_earned), 0))
                    .where(DailyProgress.user_id == current_user.id)
                )
                lifetime_xp_row = lifetime_xp_result.one()
                lifetime_xp = int(lifetime_xp_row[0] if isinstance(lifetime_xp_row, tuple) or hasattr(lifetime_xp_row, "__getitem__") else lifetime_xp_row)

                lifetime_lessons_result = await session.exec(
                    select(func.coalesce(func.sum(DailyProgress.lessons_completed), 0))
                    .where(DailyProgress.user_id == current_user.id)
                )
                lifetime_lessons_row = lifetime_lessons_result.one()
                lifetime_lessons = int(lifetime_lessons_row[0] if isinstance(lifetime_lessons_row, tuple) or hasattr(lifetime_lessons_row, "__getitem__") else lifetime_lessons_row)

                for ach_key, cfg in ACHIEVEMENTS.items():
                    if ach_key in existing_keys:
                        continue
                    unlocked = False
                    if cfg["threshold_type"] == "lifetime_xp":
                        unlocked = lifetime_xp >= cfg["threshold"]
                    elif cfg["threshold_type"] == "streak":
                        unlocked = new_streak >= cfg["threshold"]
                    elif cfg["threshold_type"] == "lifetime_lessons":
                        unlocked = lifetime_lessons >= cfg["threshold"]
                    elif cfg["threshold_type"] == "mastery_tier" and request.topic:
                        unlocked = (
                            mastery_row is not None
                            and mastery_row.tier.value == cfg["threshold"]
                            and request.topic == cfg.get("topic")
                        )
                    if unlocked:
                        newly_unlocked.append(ach_key)

                # step 6: commit
                await session.flush()
                await session.refresh(daily_progress)
                
            except Exception as e:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"Failed to process check-in: {str(e)}"
                )
    
    return CheckInResponse(
        user_id=current_user.id,
        date_key=daily_progress.date_key,
        xp_earned=daily_progress.xp_earned,
        goal_met=daily_progress.goal_met,
        lessons_completed=daily_progress.lessons_completed,
        high_accuracy_hits=daily_accuracy.high_accuracy_hits if daily_accuracy else 0,
        new_streak=new_streak,
        bonus_xp=bonus_xp,
        multiplier_active=active_event is not None,
        event_name=event_name,
        gems_earned=gems_earned_this_checkin,
        newly_unlocked=newly_unlocked,
    )


@router.get("/mastery/config", response_model=MasteryConfigResponse, status_code=status.HTTP_200_OK)
async def get_mastery_config(
    current_user: Annotated[User, Depends(current_user)],
) -> MasteryConfigResponse:
    """Return current mastery weight configuration (read-only, authenticated users)."""
    return MasteryConfigResponse(
        weight_xp=app_settings.MASTERY_WEIGHT_XP,
        weight_acc=app_settings.MASTERY_WEIGHT_ACC,
        weight_spd=app_settings.MASTERY_WEIGHT_SPD,
        xp_ceiling=app_settings.MASTERY_XP_CEILING,
        speed_ceiling=app_settings.MASTERY_SPEED_CEILING,
        tier_silver=app_settings.MASTERY_TIER_SILVER,
        tier_gold=app_settings.MASTERY_TIER_GOLD,
        tier_platinum=app_settings.MASTERY_TIER_PLATINUM,
        tier_diamond=app_settings.MASTERY_TIER_DIAMOND,
    )


@router.get("/mastery", response_model=list[TopicMasteryResponse], status_code=status.HTTP_200_OK)
async def get_mastery(
    session: SessionDep,
    current_user: Annotated[User, Depends(current_user)],
) -> list[TopicMasteryResponse]:
    """Return all TopicMastery rows for the authenticated user."""
    result = await session.exec(
        select(TopicMastery).where(TopicMastery.user_id == current_user.id)
    )
    rows = result.all()
    entries = [r[0] if isinstance(r, tuple) or hasattr(r, "__getitem__") else r for r in rows]
    return [TopicMasteryResponse.model_validate(e) for e in entries]


@router.get("/daily-progress", response_model=CheckInResponse, status_code=status.HTTP_200_OK)
async def get_daily_progress(
    session: SessionDep,
    current_user: Annotated[User, Depends(current_user)],
) -> CheckInResponse:
    today_utc = datetime.now(timezone.utc)
    today_str = today_utc.strftime("%Y-%m-%d")

    progress_query = select(DailyProgress).where(
        DailyProgress.user_id == current_user.id,
        DailyProgress.date_key == today_str,
    )
    progress_result = await session.exec(progress_query)
    progress_row = progress_result.one_or_none()
    daily_progress = (
        progress_row[0]
        if isinstance(progress_row, tuple) or hasattr(progress_row, "__getitem__")
        else progress_row
    )

    accuracy_query = select(DailyAccuracy).where(
        DailyAccuracy.user_id == current_user.id,
        DailyAccuracy.date_key == today_str,
    )
    accuracy_result = await session.exec(accuracy_query)
    accuracy_row = accuracy_result.one_or_none()
    daily_accuracy = (
        accuracy_row[0]
        if isinstance(accuracy_row, tuple) or hasattr(accuracy_row, "__getitem__")
        else accuracy_row
    )

    gamification_profile = await session.get(UserGamification, current_user.id)
    current_streak = get_visible_streak_utc(gamification_profile)

    return CheckInResponse(
        user_id=current_user.id,
        date_key=today_str,
        xp_earned=daily_progress.xp_earned if daily_progress else 0,
        goal_met=daily_progress.goal_met if daily_progress else False,
        lessons_completed=daily_progress.lessons_completed if daily_progress else 0,
        high_accuracy_hits=daily_accuracy.high_accuracy_hits if daily_accuracy else 0,
        new_streak=current_streak,
    )


@router.get("/leaderboard", response_model=list[LeaderboardItem], status_code=status.HTTP_200_OK)
async def get_leaderboard(
    session: SessionDep,
    period_key: str | None = None,
    topic: str | None = Query(None, description="Topic filter (Food, Culture, etc.). None = Global."),
    all_time: bool = Query(False, description="If true, aggregate XP across all weeks."),
) -> list[LeaderboardItem]:
    """Get top 50 leaderboard entries for a given period."""
    if all_time:
        if topic and topic != "Global":
            period_filter = LeaderboardEntry.period_key.like(f"%::{topic}")
        else:
            period_filter = ~LeaderboardEntry.period_key.contains("::")
        
        query = (
            select(
                LeaderboardEntry.user_id,
                func.sum(LeaderboardEntry.total_xp).label("total_xp"),
            )
            .where(period_filter)
            .group_by(LeaderboardEntry.user_id)
            .order_by(func.sum(LeaderboardEntry.total_xp).desc())
            .limit(50)
        )
        result = await session.exec(query)
        rows = result.all()
        
        leaderboard_items: list[LeaderboardItem] = []
        for index, row in enumerate(rows, start=1):
            uid = row[0] if isinstance(row, tuple) or hasattr(row, "__getitem__") else row.user_id
            xp = row[1] if isinstance(row, tuple) or hasattr(row, "__getitem__") else row.total_xp
            user = await session.get(User, uid)
            name = user.name if user else "Unknown"
            leaderboard_items.append(
                LeaderboardItem(rank=index, name=name, total_xp=int(xp), user_id=uid)
            )
        return leaderboard_items

    if period_key is None:
        period_key = get_current_utc_period_key()
    if topic and topic != "Global":
        period_key = f"{period_key}::{topic}"
    query = (
        select(LeaderboardEntry)
        .where(LeaderboardEntry.period_key == period_key)
        .options(selectinload(LeaderboardEntry.user))
        .order_by(LeaderboardEntry.total_xp.desc())
        .limit(50)
    )
    result = await session.exec(query)
    rows = result.all()
    entries = [row[0] if isinstance(row, tuple) or hasattr(row, "__getitem__") else row for row in rows]

    leaderboard_items: list[LeaderboardItem] = []
    for index, entry in enumerate(entries, start=1):
        name = entry.user.name if entry.user else "Unknown"
        leaderboard_items.append(
            LeaderboardItem(
                rank=index,
                name=name,
                total_xp=entry.total_xp,
                user_id=entry.user_id,
            )
        )

    return leaderboard_items


@router.get("/leaderboard/me", response_model=MyRankResponse, status_code=status.HTTP_200_OK)
async def get_my_rank(
    session: SessionDep,
    current_user: Annotated[User, Depends(current_user)],
    period_key: str | None = Query(None, pattern=r"^WEEK-\d{4}-\d{2}$"),
    topic: str | None = Query(None, description="Topic filter (Food, Culture, etc.). None = Global."),
    all_time: bool = Query(False, description="If true, aggregate XP across all weeks."),
) -> MyRankResponse:
    """Get the authenticated user's rank and XP for a specific period."""
    gamification_profile = await session.get(UserGamification, current_user.id)
    current_streak = get_visible_streak_utc(gamification_profile)

    if all_time:
        if topic and topic != "Global":
            period_filter = LeaderboardEntry.period_key.like(f"%::{topic}")
        else:
            period_filter = ~LeaderboardEntry.period_key.contains("::")
        
        my_xp_query = select(func.coalesce(func.sum(LeaderboardEntry.total_xp), 0)).where(
            LeaderboardEntry.user_id == current_user.id,
            period_filter,
        )
        result = await session.exec(my_xp_query)
        row = result.one()
        my_xp = int(row[0] if isinstance(row, tuple) or hasattr(row, "__getitem__") else row)
        
        subquery = (
            select(
                LeaderboardEntry.user_id,
                func.sum(LeaderboardEntry.total_xp).label("total_xp"),
            )
            .where(period_filter)
            .group_by(LeaderboardEntry.user_id)
        ).subquery()
        
        count_query = select(func.count()).select_from(subquery).where(subquery.c.total_xp > my_xp)
        result = await session.exec(count_query)
        count_row = result.one()
        higher_count = count_row[0] if isinstance(count_row, tuple) or hasattr(count_row, "__getitem__") else count_row
        
        return MyRankResponse(
            rank=int(higher_count) + 1,
            total_xp=my_xp,
            current_streak=current_streak,
            period_key="ALL_TIME",
            is_current_period=True,
        )

    # step 1: determine period key
    if period_key is None:
        today_utc = datetime.now(timezone.utc).date()
        period_key = get_period_key(today_utc)
        is_current_period = True
    else:
        current_period_key = get_period_key(datetime.now(timezone.utc).date())
        is_current_period = (period_key == current_period_key)
    
    if topic and topic != "Global":
        period_key = f"{period_key}::{topic}"
    
    # step 2: fetch user's leaderboard entry
    user_entry = await session.get(
        LeaderboardEntry,
        (current_user.id, period_key)
    )
    my_xp = user_entry.total_xp if user_entry else 0
    
    # step 3: calculate rank
    count_query = select(func.count()).select_from(LeaderboardEntry).where(
        LeaderboardEntry.period_key == period_key,
        LeaderboardEntry.total_xp > my_xp
    )
    result = await session.exec(count_query)
    count_row = result.one()
    higher_count = count_row[0] if isinstance(count_row, tuple) or hasattr(count_row, "__getitem__") else count_row
    
    rank = int(higher_count) + 1
    
    return MyRankResponse(
        rank=rank,
        total_xp=my_xp,
        current_streak=current_streak,
        period_key=period_key,
        is_current_period=is_current_period
    )


@router.get("/gems/config", response_model=GemConfigResponse, status_code=status.HTTP_200_OK)
async def get_gem_config() -> GemConfigResponse:
    """Return server-side gem earn/spend rates so the frontend stays in sync."""
    return GemConfigResponse(earn_rates=GEM_EARN_RATES, spend_rates=GEM_SPEND_RATES)


@router.get("/gems", response_model=GemBalanceResponse, status_code=status.HTTP_200_OK)
async def get_gems(
    session: SessionDep,
    current_user: Annotated[User, Depends(current_user)],
) -> GemBalanceResponse:
    """Return the user's gem balance and recent transactions."""
    balance = await session.get(GemBalance, current_user.id)
    result = await session.exec(
        select(GemTransaction)
        .where(GemTransaction.user_id == current_user.id)
        .order_by(GemTransaction.created_at.desc())
        .limit(20)
    )
    rows = result.all()
    txns = [r[0] if isinstance(r, tuple) or hasattr(r, "__getitem__") else r for r in rows]
    return GemBalanceResponse(
        balance=balance.balance if balance else 0,
        transactions=[GemTransactionResponse.model_validate(t) for t in txns],
    )


@router.post("/gems/spend", response_model=SpendGemsResponse, status_code=status.HTTP_200_OK)
async def spend_gems(
    request: SpendGemsRequest,
    current_user: Annotated[User, Depends(current_user)],
    repository: Repository,
) -> SpendGemsResponse:
    """Atomically deduct gems for an item purchase."""
    cost = GEM_SPEND_RATES.get(request.item_key)
    if cost is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unknown item",
        )
    async with repository.session() as session:
        async with session.begin():
            result = await session.exec(
                select(GemBalance)
                .where(GemBalance.user_id == current_user.id)
                .with_for_update()
            )
            balance_row = result.one_or_none()
            if balance_row and (isinstance(balance_row, tuple) or hasattr(balance_row, "__getitem__")):
                balance_row = balance_row[0]
            if not balance_row or balance_row.balance < cost:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Insufficient gems",
                )
            balance_row.balance -= cost
            session.add(GemTransaction(
                user_id=current_user.id, amount=-cost, reason=request.item_key,
            ))

            inv_result = await session.exec(
                select(UserInventory).where(UserInventory.user_id == current_user.id)
            )
            inventory = inv_result.one_or_none()
            if inventory and (isinstance(inventory, tuple) or hasattr(inventory, "__getitem__")):
                inventory = inventory[0]
            if not inventory:
                inventory = UserInventory(user_id=current_user.id)

            if request.item_key == "streak_freeze":
                inventory.streak_freezes += 1
            elif request.item_key == "xp_boost_1h":
                now = datetime.utcnow()
                session.add(XPMultiplierEvent(
                    name="Personal XP Boost",
                    description="2x XP for 1 hour (purchased)",
                    multiplier=2.0,
                    starts_at=now,
                    ends_at=now + timedelta(hours=1),
                    is_active=True,
                ))
            elif request.item_key == "xp_boost_30m_30x":
                now = datetime.utcnow()
                session.add(XPMultiplierEvent(
                    name="Mega XP Boost",
                    description="30x XP for 30 minutes (purchased)",
                    multiplier=10.0,
                    starts_at=now,
                    ends_at=now + timedelta(minutes=30),
                    is_active=True,
                ))
            elif request.item_key == "buy_xp_500":
                dp_result = await session.exec(
                    select(DailyProgress).where(
                        DailyProgress.user_id == current_user.id,
                        DailyProgress.date_key == datetime.utcnow().strftime("%Y-%m-%d"),
                    )
                )
                dp_row = dp_result.one_or_none()
                if dp_row and (isinstance(dp_row, tuple) or hasattr(dp_row, "__getitem__")):
                    dp_row = dp_row[0]
                if dp_row:
                    dp_row.xp_earned += 500
                else:
                    dp_row = DailyProgress(
                        user_id=current_user.id,
                        date_key=datetime.utcnow().strftime("%Y-%m-%d"),
                        xp_earned=500,
                    )
                session.add(dp_row)

            session.add(inventory)
            await session.flush()
    return SpendGemsResponse(new_balance=balance_row.balance, item_key=request.item_key)


@router.get("/achievements", response_model=list[AchievementResponse], status_code=status.HTTP_200_OK)
async def get_achievements(
    session: SessionDep,
    current_user: Annotated[User, Depends(current_user)],
) -> list[AchievementResponse]:
    """Return all achievements with locked/unlocked status and progress."""
    result = await session.exec(
        select(UserAchievement).where(UserAchievement.user_id == current_user.id)
    )
    rows = result.all()
    entries = [r[0] if isinstance(r, tuple) or hasattr(r, "__getitem__") else r for r in rows]
    unlocked_map = {e.achievement_key: e.unlocked_at for e in entries}

    xp_result = await session.exec(
        select(func.coalesce(func.sum(DailyProgress.xp_earned), 0))
        .where(DailyProgress.user_id == current_user.id)
    )
    xp_row = xp_result.one()
    lifetime_xp = int(xp_row[0] if isinstance(xp_row, tuple) or hasattr(xp_row, "__getitem__") else xp_row)

    lessons_result = await session.exec(
        select(func.coalesce(func.sum(DailyProgress.lessons_completed), 0))
        .where(DailyProgress.user_id == current_user.id)
    )
    lessons_row = lessons_result.one()
    lifetime_lessons = int(lessons_row[0] if isinstance(lessons_row, tuple) or hasattr(lessons_row, "__getitem__") else lessons_row)

    gam_profile = await session.get(UserGamification, current_user.id)
    current_streak = get_visible_streak_utc(gam_profile)

    mastery_result = await session.exec(
        select(TopicMastery).where(TopicMastery.user_id == current_user.id)
    )
    mastery_rows = mastery_result.all()
    mastery_map = {}
    for m in mastery_rows:
        entry = m[0] if isinstance(m, tuple) or hasattr(m, "__getitem__") else m
        mastery_map[entry.topic] = entry

    responses: list[AchievementResponse] = []
    for key, cfg in ACHIEVEMENTS.items():
        is_unlocked = key in unlocked_map
        progress = 1.0 if is_unlocked else 0.0

        if not is_unlocked:
            t = cfg["threshold_type"]
            if t == "lifetime_xp":
                progress = min(lifetime_xp / cfg["threshold"], 1.0)
            elif t == "streak":
                progress = min(current_streak / cfg["threshold"], 1.0)
            elif t == "lifetime_lessons":
                progress = min(lifetime_lessons / cfg["threshold"], 1.0)
            elif t == "mastery_tier":
                topic = cfg.get("topic")
                if topic and topic in mastery_map:
                    progress = min(mastery_map[topic].mastery_score / app_settings.MASTERY_TIER_DIAMOND, 1.0)
            elif t in ("weekly_rank", "alltime_rank"):
                progress = 0.0

        responses.append(AchievementResponse(
            key=key, title=cfg["title"], desc=cfg["desc"],
            unlocked=is_unlocked, unlocked_at=unlocked_map.get(key),
            progress=round(progress, 2),
            gem_reward=cfg.get("gem_reward", 15),
            ultimate=cfg.get("ultimate", False),
        ))
    return responses


@router.post("/achievements/claim", response_model=ClaimAchievementResponse, status_code=status.HTTP_200_OK)
async def claim_achievement(
    request: ClaimAchievementRequest,
    current_user: Annotated[User, Depends(current_user)],
    repository: Repository,
) -> ClaimAchievementResponse:
    """Claim an achievement that has reached 100% progress, awarding gems."""
    cfg = ACHIEVEMENTS.get(request.achievement_key)
    if cfg is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unknown achievement")

    async with repository.session() as session:
        async with session.begin():
            # Check not already unlocked
            existing = await session.exec(
                select(UserAchievement).where(
                    UserAchievement.user_id == current_user.id,
                    UserAchievement.achievement_key == request.achievement_key,
                )
            )
            if existing.one_or_none() is not None:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Already claimed")

            # Verify threshold is met
            t = cfg["threshold_type"]
            met = False

            if t == "lifetime_xp":
                xp_r = await session.exec(
                    select(func.coalesce(func.sum(DailyProgress.xp_earned), 0))
                    .where(DailyProgress.user_id == current_user.id)
                )
                row = xp_r.one()
                val = int(row[0] if isinstance(row, tuple) or hasattr(row, "__getitem__") else row)
                met = val >= cfg["threshold"]
            elif t == "streak":
                gam = await session.get(UserGamification, current_user.id)
                met = get_visible_streak_utc(gam) >= cfg["threshold"]
            elif t == "lifetime_lessons":
                l_r = await session.exec(
                    select(func.coalesce(func.sum(DailyProgress.lessons_completed), 0))
                    .where(DailyProgress.user_id == current_user.id)
                )
                row = l_r.one()
                val = int(row[0] if isinstance(row, tuple) or hasattr(row, "__getitem__") else row)
                met = val >= cfg["threshold"]
            elif t == "mastery_tier":
                topic = cfg.get("topic")
                if topic:
                    m_r = await session.exec(
                        select(TopicMastery).where(
                            TopicMastery.user_id == current_user.id,
                            TopicMastery.topic == topic,
                        )
                    )
                    mrow = m_r.one_or_none()
                    if mrow and (isinstance(mrow, tuple) or hasattr(mrow, "__getitem__")):
                        mrow = mrow[0]
                    met = mrow is not None and mrow.tier.value == cfg["threshold"]
            elif t == "weekly_rank":
                today_utc = datetime.now(timezone.utc).date()
                current_pk = get_period_key(today_utc)
                top_r = await session.exec(
                    select(LeaderboardEntry)
                    .where(LeaderboardEntry.period_key == current_pk)
                    .order_by(LeaderboardEntry.total_xp.desc())
                    .limit(1)
                )
                top_row = top_r.one_or_none()
                if top_row and (isinstance(top_row, tuple) or hasattr(top_row, "__getitem__")):
                    top_row = top_row[0]
                met = top_row is not None and top_row.user_id == current_user.id
            elif t == "alltime_rank":
                global_filter = ~LeaderboardEntry.period_key.contains("::")
                subq = (
                    select(
                        LeaderboardEntry.user_id,
                        func.sum(LeaderboardEntry.total_xp).label("total_xp"),
                    )
                    .where(global_filter)
                    .group_by(LeaderboardEntry.user_id)
                    .order_by(func.sum(LeaderboardEntry.total_xp).desc())
                    .limit(1)
                ).subquery()
                top_r = await session.exec(select(subq.c.user_id))
                top_uid_row = top_r.one_or_none()
                if top_uid_row:
                    top_uid = top_uid_row[0] if isinstance(top_uid_row, tuple) or hasattr(top_uid_row, "__getitem__") else top_uid_row
                    met = top_uid == current_user.id

            if not met:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Achievement criteria not met")

            # Unlock + award gems
            session.add(UserAchievement(
                user_id=current_user.id, achievement_key=request.achievement_key,
            ))
            gem_amount = cfg.get("gem_reward", 15)

            gem_result = await session.exec(
                select(GemBalance)
                .where(GemBalance.user_id == current_user.id)
                .with_for_update()
            )
            gem_row = gem_result.one_or_none()
            if gem_row and (isinstance(gem_row, tuple) or hasattr(gem_row, "__getitem__")):
                gem_row = gem_row[0]
            if not gem_row:
                gem_row = GemBalance(user_id=current_user.id, balance=0)
            gem_row.balance += gem_amount
            session.add(gem_row)
            session.add(GemTransaction(
                user_id=current_user.id, amount=gem_amount, reason=f"achievement:{request.achievement_key}",
            ))
            await session.flush()

    return ClaimAchievementResponse(
        achievement_key=request.achievement_key,
        gems_awarded=gem_amount,
        new_balance=gem_row.balance,
    )


@router.get("/inventory", response_model=UserInventoryResponse, status_code=status.HTTP_200_OK)
async def get_inventory(
    session: SessionDep,
    current_user: Annotated[User, Depends(current_user)],
) -> UserInventoryResponse:
    """Return the user's item inventory."""
    result = await session.exec(
        select(UserInventory).where(UserInventory.user_id == current_user.id)
    )
    row = result.one_or_none()
    if row and (isinstance(row, tuple) or hasattr(row, "__getitem__")):
        row = row[0]
    if not row:
        return UserInventoryResponse()
    return UserInventoryResponse.model_validate(row)


@router.get("/leaderboard/proximity", response_model=ProximityResponse, status_code=status.HTTP_200_OK)
async def get_proximity(
    current_user: Annotated[User, Depends(current_user)],
    session: SessionDep,
    topic: str | None = Query(None),
    all_time: bool = Query(False),
    xp_window: int = Query(200, ge=10, le=1000,
        description="XP range above/below user to search. Default 200."),
) -> ProximityResponse:
    """Return users within xp_window above/below the current user."""

    # Determine period key and filter (reuse logic from /leaderboard)
    if all_time:
        if topic and topic != "Global":
            period_filter = LeaderboardEntry.period_key.like(f"%::{topic}")
        else:
            period_filter = ~LeaderboardEntry.period_key.contains("::")

        # Current user's total XP across all periods
        my_xp_q = select(func.coalesce(func.sum(LeaderboardEntry.total_xp), 0)).where(
            LeaderboardEntry.user_id == current_user.id, period_filter,
        )
        result = await session.exec(my_xp_q)
        row = result.one()
        my_xp = int(row[0] if isinstance(row, tuple) or hasattr(row, "__getitem__") else row)

        if my_xp == 0:
            return ProximityResponse(above=[], below=[], my_xp=0, my_rank=1)

        # Aggregated subquery
        agg = (
            select(
                LeaderboardEntry.user_id,
                func.sum(LeaderboardEntry.total_xp).label("total_xp"),
            )
            .where(period_filter)
            .group_by(LeaderboardEntry.user_id)
        ).subquery()

        # my_rank (Standard Competition: count of users with strictly more XP + 1)
        rank_q = select(func.count()).select_from(agg).where(agg.c.total_xp > my_xp)
        result = await session.exec(rank_q)
        rr = result.one()
        my_rank = int(rr[0] if isinstance(rr, tuple) or hasattr(rr, "__getitem__") else rr) + 1

        # Above: users with XP in (my_xp, my_xp + window], closest first
        above_q = (
            select(agg.c.user_id, agg.c.total_xp)
            .where(agg.c.total_xp > my_xp, agg.c.total_xp <= my_xp + xp_window)
            .order_by(agg.c.total_xp.asc())
            .limit(5)
        )
        result = await session.exec(above_q)
        above_rows = result.all()

        # Below: users with XP in [my_xp - window, my_xp), closest first
        below_q = (
            select(agg.c.user_id, agg.c.total_xp)
            .where(agg.c.total_xp < my_xp, agg.c.total_xp >= my_xp - xp_window)
            .order_by(agg.c.total_xp.desc())
            .limit(5)
        )
        result = await session.exec(below_q)
        below_rows = result.all()

        async def _to_neighbour_agg(row, my_xp_val):
            uid = row[0] if isinstance(row, tuple) or hasattr(row, "__getitem__") else row.user_id
            xp = int(row[1] if isinstance(row, tuple) or hasattr(row, "__getitem__") else row.total_xp)
            user = await session.get(User, uid)
            # Standard Competition Ranking for this neighbour
            rq = select(func.count()).select_from(agg).where(agg.c.total_xp > xp)
            res = await session.exec(rq)
            rr2 = res.one()
            nrank = int(rr2[0] if isinstance(rr2, tuple) or hasattr(rr2, "__getitem__") else rr2) + 1
            return ProximityNeighbour(
                user_id=str(uid), name=user.name if user else "Unknown",
                total_xp=xp, rank=nrank, xp_gap=abs(xp - my_xp_val),
            )

        above = [await _to_neighbour_agg(r, my_xp) for r in above_rows]
        below = [await _to_neighbour_agg(r, my_xp) for r in below_rows]
        return ProximityResponse(above=above, below=below, my_xp=my_xp, my_rank=my_rank)

    # Weekly period logic
    effective_period_key = get_current_utc_period_key()
    if topic and topic != "Global":
        effective_period_key = f"{effective_period_key}::{topic}"

    user_entry = await session.get(LeaderboardEntry, (current_user.id, effective_period_key))
    my_xp = user_entry.total_xp if user_entry else 0

    if my_xp == 0:
        return ProximityResponse(above=[], below=[], my_xp=0, my_rank=1)

    # my_rank
    count_q = select(func.count()).select_from(LeaderboardEntry).where(
        LeaderboardEntry.period_key == effective_period_key,
        LeaderboardEntry.total_xp > my_xp,
    )
    result = await session.exec(count_q)
    cr = result.one()
    my_rank = int(cr[0] if isinstance(cr, tuple) or hasattr(cr, "__getitem__") else cr) + 1

    # Above
    above_q = (
        select(LeaderboardEntry)
        .where(
            LeaderboardEntry.period_key == effective_period_key,
            LeaderboardEntry.total_xp > my_xp,
            LeaderboardEntry.total_xp <= my_xp + xp_window,
        )
        .options(selectinload(LeaderboardEntry.user))
        .order_by(LeaderboardEntry.total_xp.asc())
        .limit(5)
    )
    result = await session.exec(above_q)
    above_entries = [r[0] if isinstance(r, tuple) or hasattr(r, "__getitem__") else r for r in result.all()]

    # Below
    below_q = (
        select(LeaderboardEntry)
        .where(
            LeaderboardEntry.period_key == effective_period_key,
            LeaderboardEntry.total_xp < my_xp,
            LeaderboardEntry.total_xp >= my_xp - xp_window,
        )
        .options(selectinload(LeaderboardEntry.user))
        .order_by(LeaderboardEntry.total_xp.desc())
        .limit(5)
    )
    result = await session.exec(below_q)
    below_entries = [r[0] if isinstance(r, tuple) or hasattr(r, "__getitem__") else r for r in result.all()]

    async def _to_neighbour(entry, period_key, my_xp_val):
        rq = select(func.count()).select_from(LeaderboardEntry).where(
            LeaderboardEntry.period_key == period_key,
            LeaderboardEntry.total_xp > entry.total_xp,
        )
        res = await session.exec(rq)
        rr2 = res.one()
        nrank = int(rr2[0] if isinstance(rr2, tuple) or hasattr(rr2, "__getitem__") else rr2) + 1
        return ProximityNeighbour(
            user_id=str(entry.user_id), name=entry.user.name if entry.user else "Unknown",
            total_xp=entry.total_xp, rank=nrank, xp_gap=abs(entry.total_xp - my_xp_val),
        )

    above = [await _to_neighbour(e, effective_period_key, my_xp) for e in above_entries]
    below = [await _to_neighbour(e, effective_period_key, my_xp) for e in below_entries]
    return ProximityResponse(above=above, below=below, my_xp=my_xp, my_rank=my_rank)


# ── XP History & Stats (Week 16) ───────────────────────────────────────────

async def _zero_filled_history(
    session, user_id, days: int
) -> list[HistoryEntry]:
    """Return exactly `days` HistoryEntry items, zero-filling missing dates."""
    today = datetime.now(timezone.utc).date()
    start_date = today - timedelta(days=days - 1)

    result = await session.exec(
        select(DailyProgress).where(
            DailyProgress.user_id == user_id,
            DailyProgress.date_key >= start_date.isoformat(),
            DailyProgress.date_key <= today.isoformat(),
        )
    )
    rows = result.all()
    data_map: dict[str, DailyProgress] = {}
    for row in rows:
        r = row[0] if isinstance(row, tuple) or hasattr(row, "__getitem__") else row
        data_map[r.date_key] = r

    history: list[HistoryEntry] = []
    current = start_date
    while current <= today:
        key = current.isoformat()
        if key in data_map:
            dp = data_map[key]
            history.append(HistoryEntry(
                date_key=key,
                xp_earned=dp.xp_earned,
                goal_met=dp.goal_met,
                lessons_completed=dp.lessons_completed,
            ))
        else:
            history.append(HistoryEntry(
                date_key=key, xp_earned=0, goal_met=False, lessons_completed=0,
            ))
        current += timedelta(days=1)
    return history


@router.get("/history", response_model=list[HistoryEntry], status_code=status.HTTP_200_OK)
async def get_xp_history(
    current_user: Annotated[User, Depends(current_user)],
    session: SessionDep,
    days: int = Query(30, ge=7, le=365),
) -> list[HistoryEntry]:
    """Return daily XP history with zero-filled gaps."""
    return await _zero_filled_history(session, current_user.id, days)


@router.get("/stats", response_model=StatsResponse, status_code=status.HTTP_200_OK)
async def get_stats(
    current_user: Annotated[User, Depends(current_user)],
    session: SessionDep,
) -> StatsResponse:
    """Aggregated stats: 7-day avg, best 30-day streak, completion rate, lifetime XP."""
    history = await _zero_filled_history(session, current_user.id, 30)

    last_7 = history[-7:]
    seven_day_avg = sum(e.xp_earned for e in last_7) / 7

    goals_met = sum(1 for e in history if e.goal_met)
    completion_rate = goals_met / 30 * 100

    best_streak = 0
    current_run = 0
    for entry in history:
        if entry.xp_earned > 0:
            current_run += 1
            best_streak = max(best_streak, current_run)
        else:
            current_run = 0

    result = await session.exec(
        select(func.coalesce(func.sum(DailyProgress.xp_earned), 0)).where(
            DailyProgress.user_id == current_user.id,
        )
    )
    lifetime_xp = result.one()[0]

    return StatsResponse(
        seven_day_avg_xp=round(seven_day_avg, 1),
        thirty_day_best_streak=best_streak,
        completion_rate_30d=round(completion_rate, 1),
        lifetime_xp=lifetime_xp,
    )
