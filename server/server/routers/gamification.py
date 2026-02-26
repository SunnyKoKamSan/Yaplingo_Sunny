"""
Gamification Router
===================
Handles user check-ins, progress tracking, and gamification features.
Uses server-side UTC time for anti-cheat protection.
"""
from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.orm import selectinload

from server.core.gamification import get_period_key, get_visible_streak_utc, update_streak_utc
from server.dependencies import Repository, SessionDep, current_user
from server.repository.gamification import ACHIEVEMENTS, DailyAccuracy, DailyProgress, GEM_EARN_RATES, GEM_SPEND_RATES, GemBalance, GemTransaction, LeaderboardEntry, MasteryTier, TopicMastery, UserAchievement, UserGamification, XPMultiplierEvent
from server.repository.models import User
from server.schemas import AchievementResponse, ActiveEventResponse, CheckInRequest, CheckInResponse, GemBalanceResponse, GemTransactionResponse, LeaderboardItem, MyRankResponse, SpendGemsRequest, SpendGemsResponse, TopicMasteryResponse
from server.utils import get_current_utc_period_key
from server.settings import settings as app_settings

router = APIRouter()

# Constants
DAILY_GOAL_XP = 200  # XP required to meet daily goal
HIGH_ACCURACY_THRESHOLD = 80  # score percentage counted as "Hit 80%"


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
    """
    Record user activity check-in for gamification tracking.
    
    **SERVER-SIDE AUTHORITY:** All dates/times use UTC on the server.
    This prevents users from cheating by manipulating their device time.
    
    **ATOMIC TRANSACTION:** All updates (DailyProgress, Streak, Leaderboard)
    are committed together or rolled back together, ensuring data consistency.
    
    **WRITE-THROUGH CACHING:** Leaderboard entries are updated incrementally
    during check-in, eliminating expensive SUM() aggregations on reads.
    
    Args:
        request: CheckInRequest containing xp_amount
        current_user: Authenticated user (injected by JWT dependency)
        repository: Database repository (injected dependency)
        
    Returns:
        CheckInResponse with updated stats and streak
        
    Raises:
        HTTPException: 500 if database operation fails
    """
    async with repository.session() as session:
        async with session.begin():
            try:
                # ════════════════════════════════════════════════════════════
                # STEP 0: CHECK FOR ACTIVE XP MULTIPLIER EVENT (Anti-Cheat)
                # ════════════════════════════════════════════════════════════
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

                # ════════════════════════════════════════════════════════════
                # STEP 1: GENERATE SERVER UTC DATE (Anti-Cheat Protection)
                # ════════════════════════════════════════════════════════════
                today_utc = now_utc
                today_str = today_utc.strftime("%Y-%m-%d")
                today_date = today_utc.date()
                period_key = get_period_key(today_date)
                
                # ════════════════════════════════════════════════════════════
                # STEP 2: UPSERT DAILY PROGRESS
                # ════════════════════════════════════════════════════════════
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
                    # UPDATE: Increment XP and lesson count
                    daily_progress.xp_earned += effective_xp
                    daily_progress.lessons_completed += 1
                else:
                    # CREATE: New daily progress record
                    daily_progress = DailyProgress(
                        user_id=current_user.id,
                        date_key=today_str,
                        xp_earned=effective_xp,
                        lessons_completed=1,
                        goal_met=False
                    )
                    session.add(daily_progress)
                
                # Check if daily goal threshold is reached
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
                
                # ════════════════════════════════════════════════════════════
                # STEP 3: UPDATE STREAK (Server UTC Time Authority)
                # ════════════════════════════════════════════════════════════
                new_streak = await update_streak_utc(
                    session=session,
                    user_id=current_user.id,
                )
                
                # ════════════════════════════════════════════════════════════
                # STEP 4: UPSERT LEADERBOARD ENTRY (Write-Through)
                # ════════════════════════════════════════════════════════════
                # Always update the Global leaderboard entry
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
                
                # If a topic was provided, also update a topic-specific leaderboard entry
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
                
                # ════════════════════════════════════════════════════════════
                # STEP 4.5: UPSERT TOPIC MASTERY (only when topic provided)
                # ════════════════════════════════════════════════════════════
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
                
                # ════════════════════════════════════════════════════════════
                # STEP 5: GEM AWARDS (inside same transaction)
                # ════════════════════════════════════════════════════════════
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

                # Daily goal met — award only on the lesson that first triggers it
                was_goal_met_before = (daily_progress.xp_earned - effective_xp) >= DAILY_GOAL_XP
                if daily_progress.goal_met and not was_goal_met_before:
                    award_gems(GEM_EARN_RATES["daily_goal_met"], "daily_goal_met")

                # Streak milestones
                if new_streak == 7:
                    award_gems(GEM_EARN_RATES["streak_7"], "streak_7")
                if new_streak == 30:
                    award_gems(GEM_EARN_RATES["streak_30"], "streak_30")

                # Mastery tier upgrade
                if request.topic and mastery_row:
                    old_tier = old_mastery_tier
                    if old_tier is not None and mastery_row.tier != old_tier:
                        award_gems(GEM_EARN_RATES["mastery_tier_upgrade"], "mastery_tier_upgrade")

                # ════════════════════════════════════════════════════════════
                # STEP 5.5: ACHIEVEMENT EVALUATION
                # ════════════════════════════════════════════════════════════
                existing_achievements_result = await session.exec(
                    select(UserAchievement.achievement_key)
                    .where(UserAchievement.user_id == current_user.id)
                )
                existing_keys = set(existing_achievements_result.all())

                # Calculate lifetime XP
                lifetime_xp_result = await session.exec(
                    select(func.coalesce(func.sum(DailyProgress.xp_earned), 0))
                    .where(DailyProgress.user_id == current_user.id)
                )
                lifetime_xp_row = lifetime_xp_result.one()
                lifetime_xp = int(lifetime_xp_row[0] if isinstance(lifetime_xp_row, tuple) or hasattr(lifetime_xp_row, "__getitem__") else lifetime_xp_row)

                for ach_key, cfg in ACHIEVEMENTS.items():
                    if ach_key in existing_keys:
                        continue
                    unlocked = False
                    if cfg["threshold_type"] == "lifetime_xp":
                        unlocked = lifetime_xp >= cfg["threshold"]
                    elif cfg["threshold_type"] == "streak":
                        unlocked = new_streak >= cfg["threshold"]
                    elif cfg["threshold_type"] == "mastery_tier" and request.topic:
                        unlocked = (
                            mastery_row is not None
                            and mastery_row.tier.value == cfg["threshold"]
                            and request.topic == cfg.get("topic")
                        )
                    if unlocked:
                        session.add(UserAchievement(
                            user_id=current_user.id, achievement_key=ach_key
                        ))
                        award_gems(GEM_EARN_RATES["achievement_unlocked"], f"achievement:{ach_key}")
                        newly_unlocked.append(ach_key)

                # ════════════════════════════════════════════════════════════
                # STEP 6: COMMIT TRANSACTION
                # ════════════════════════════════════════════════════════════
                # Flush to database to get updated values
                await session.flush()
                await session.refresh(daily_progress)
                
                # Transaction auto-commits on context manager exit
                
            except Exception as e:
                # Transaction auto-rolls back on exception
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"Failed to process check-in: {str(e)}"
                )
    
    # Return updated progress (outside transaction)
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
    """
    Get top 50 leaderboard entries for a given period.
    
    **UTC-First Architecture:**
    - If no period_key is provided, automatically uses the current UTC week.
    - This ensures all users globally see the same "current week" standings,
      preventing timezone-based mismatches.
    - If all_time=true, aggregates XP across all weeks.
    """
    if all_time:
        # Aggregate XP across all period keys for each user
        # For topic-specific: match period_keys ending with ::Topic
        # For Global: match period_keys that are base WEEK-YYYY-WW (no :: suffix)
        if topic and topic != "Global":
            # Sum all topic-specific entries
            period_filter = LeaderboardEntry.period_key.like(f"%::{topic}")
        else:
            # Sum all Global entries (period_key has no :: suffix)
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
            # Fetch user name
            user = await session.get(User, uid)
            name = user.name if user else "Unknown"
            leaderboard_items.append(
                LeaderboardItem(rank=index, name=name, total_xp=int(xp), user_id=uid)
            )
        return leaderboard_items

    # UTC-First: Default to current week if not specified
    if period_key is None:
        period_key = get_current_utc_period_key()
    # Append topic suffix for topic-specific queries (Global uses base period_key)
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
    """
    Get the authenticated user's rank and XP for a specific period.
    
    **Performance:** Uses optimized COUNT query instead of fetching all rows.
    This scales to millions of users with O(1) complexity thanks to the
    (period_key, total_xp) index.
    
    **Ranking Logic:**
    - Rank = (number of users with higher XP) + 1
    - Users with no entry get rank based on total participants + 1
    - Ties are handled using ">" operator (dense ranking approximation)
    
    Args:
        session: Async database session (injected)
        current_user: Authenticated user (injected by JWT dependency)
        period_key: Optional period identifier (e.g., "WEEK-2026-05").
                   If None, defaults to current UTC week.
                   Must match format WEEK-YYYY-WW if provided.
    
    Returns:
        MyRankResponse with rank, total_xp, period_key, and is_current_period flag
        
    Examples:
        # Get current week rank
        GET /gamification/leaderboard/me
        
        # Get historical week rank
        GET /gamification/leaderboard/me?period_key=WEEK-2026-04
        
    Edge Cases Handled:
        - User has no entry yet: returns rank based on participant count + 1, xp = 0
        - Zero participants: rank = 1 (user would be first if they played)
        - Ties: Users with equal XP get consecutive ranks (not same rank)
    """
    gamification_profile = await session.get(UserGamification, current_user.id)
    current_streak = get_visible_streak_utc(gamification_profile)

    # ════════════════════════════════════════════════════════════════
    # ALL TIME MODE: Aggregate XP across all weeks
    # ════════════════════════════════════════════════════════════════
    if all_time:
        if topic and topic != "Global":
            period_filter = LeaderboardEntry.period_key.like(f"%::{topic}")
        else:
            period_filter = ~LeaderboardEntry.period_key.contains("::")
        
        # Get my total XP across all weeks
        my_xp_query = select(func.coalesce(func.sum(LeaderboardEntry.total_xp), 0)).where(
            LeaderboardEntry.user_id == current_user.id,
            period_filter,
        )
        result = await session.exec(my_xp_query)
        row = result.one()
        my_xp = int(row[0] if isinstance(row, tuple) or hasattr(row, "__getitem__") else row)
        
        # Count users with higher total XP
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

    # ════════════════════════════════════════════════════════════════
    # STEP 1: DETERMINE PERIOD KEY (Server UTC Authority)
    # ════════════════════════════════════════════════════════════════
    if period_key is None:
        today_utc = datetime.now(timezone.utc).date()
        period_key = get_period_key(today_utc)
        is_current_period = True
    else:
        # Historical period lookup
        current_period_key = get_period_key(datetime.now(timezone.utc).date())
        is_current_period = (period_key == current_period_key)
    
    # Append topic suffix for topic-specific queries (Global uses base period_key)
    if topic and topic != "Global":
        period_key = f"{period_key}::{topic}"
    
    # ════════════════════════════════════════════════════════════════
    # STEP 2: FETCH USER'S LEADERBOARD ENTRY
    # ════════════════════════════════════════════════════════════════
    user_entry = await session.get(
        LeaderboardEntry,
        (current_user.id, period_key)
    )
    my_xp = user_entry.total_xp if user_entry else 0
    
    # ════════════════════════════════════════════════════════════════
    # STEP 3: CALCULATE RANK USING EFFICIENT COUNT QUERY
    # ════════════════════════════════════════════════════════════════
    # Why COUNT instead of fetching all rows?
    # - Fetching all: O(n) memory + network transfer + Python sorting
    # - COUNT query: O(log n) with index, minimal memory, single number returned
    # - With 10k users: COUNT = 1ms vs fetch+sort = 500ms
    # - Database index on (period_key, total_xp) makes this blazing fast
    
    count_query = select(func.count()).select_from(LeaderboardEntry).where(
        LeaderboardEntry.period_key == period_key,
        LeaderboardEntry.total_xp > my_xp
    )
    result = await session.exec(count_query)
    count_row = result.one()
    higher_count = count_row[0] if isinstance(count_row, tuple) or hasattr(count_row, "__getitem__") else count_row
    
    # Rank = number of users with higher XP + 1
    rank = int(higher_count) + 1
    
    return MyRankResponse(
        rank=rank,
        total_xp=my_xp,
        current_streak=current_streak,
        period_key=period_key,
        is_current_period=is_current_period
    )


# ══════════════════════════════════════════════════════════════════════════════
# GEM & ACHIEVEMENT ENDPOINTS
# ══════════════════════════════════════════════════════════════════════════════

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
            await session.flush()
    return SpendGemsResponse(new_balance=balance_row.balance, item_key=request.item_key)


@router.get("/achievements", response_model=list[AchievementResponse], status_code=status.HTTP_200_OK)
async def get_achievements(
    session: SessionDep,
    current_user: Annotated[User, Depends(current_user)],
) -> list[AchievementResponse]:
    """Return all achievements with locked/unlocked status for the user."""
    result = await session.exec(
        select(UserAchievement).where(UserAchievement.user_id == current_user.id)
    )
    rows = result.all()
    entries = [r[0] if isinstance(r, tuple) or hasattr(r, "__getitem__") else r for r in rows]
    unlocked_map = {e.achievement_key: e.unlocked_at for e in entries}
    return [
        AchievementResponse(
            key=key,
            title=cfg["title"],
            desc=cfg["desc"],
            unlocked=key in unlocked_map,
            unlocked_at=unlocked_map.get(key),
        )
        for key, cfg in ACHIEVEMENTS.items()
    ]
