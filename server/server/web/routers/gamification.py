from datetime import date, datetime, timedelta, timezone
from fastapi import APIRouter, Query
from sqlalchemy import func, or_, select
from sqlalchemy.orm import selectinload
from sqlmodel.ext.asyncio.session import AsyncSession

from server.core.gamification import (
    get_current_utc_period_key,
    get_period_key,
    get_visible_streak_utc,
    update_streak_utc,
)
from server.repository.gamification import (
    DailyAccuracy,
    DailyProgress,
    LeaderboardEntry,
    MasteryTier,
    TopicMastery,
    UserGamification,
    XPMultiplierEvent,
)
from server.repository.models import User
from server.web.dependencies import Service, SessionDep, User as AuthUser
from server.web.schemas.gamification import (
    ActiveEventResponse,
    CheckInRequest,
    CheckInResponse,
    HistoryEntry,
    LeaderboardItem,
    MasteryConfigResponse,
    MyRankResponse,
    ProximityNeighbour,
    ProximityResponse,
    StatsResponse,
    TopicMasteryResponse,
)
from server.web.settings import settings as app_settings

router = APIRouter()

DAILY_GOAL_XP = 200
HIGH_ACCURACY_THRESHOLD = 80
TOPIC_ALIASES: dict[str, str] = {
    "global": "Global",
    "food": "Food",
    "culture": "Culture",
    "travel": "Travel",
    "business": "Business",
    "technology": "Technology",
    "tech": "Technology",
}


def _unwrap(row):
    """Unwrap SQLModel result row if it's a tuple."""
    if row is None:
        return None
    return row[0] if isinstance(row, tuple) or hasattr(row, "__getitem__") else row


def _period_key_to_week_bounds(period_key: str) -> tuple[date, date]:
    _, year_str, week_str = period_key.split("-")
    week_start = date.fromisocalendar(int(year_str), int(week_str), 1)
    return week_start, week_start + timedelta(days=6)


async def _get_period_streak(session: AsyncSession, user_id, period_key: str) -> int:
    week_start, week_end = _period_key_to_week_bounds(period_key)
    result = await session.exec(
        select(DailyProgress.date_key).where(
            DailyProgress.user_id == user_id,
            DailyProgress.date_key >= week_start.isoformat(),
            DailyProgress.date_key <= week_end.isoformat(),
            DailyProgress.xp_earned > 0,
        )
    )
    active_days = {_unwrap(row) for row in result.all()}
    best_run = 0
    current_run = 0
    day = week_start
    while day <= week_end:
        if day.isoformat() in active_days:
            current_run += 1
            best_run = max(best_run, current_run)
        else:
            current_run = 0
        day += timedelta(days=1)
    return best_run


def _normalize_topic(topic: str | None) -> str | None:
    if topic is None:
        return None
    value = topic.strip()
    if not value:
        return None
    return TOPIC_ALIASES.get(value.casefold(), value)


def _topic_period_keys(period_key: str, topic: str | None) -> list[str]:
    normalized_topic = _normalize_topic(topic)
    if normalized_topic is None or normalized_topic == "Global":
        return [period_key]
    keys = [f"{period_key}::{normalized_topic}"]
    legacy_aliases = {normalized_topic.lower()}
    if normalized_topic == "Technology":
        legacy_aliases.add("tech")
    keys.extend(
        f"{period_key}::{alias}"
        for alias in legacy_aliases
        if alias != normalized_topic
    )
    return list(dict.fromkeys(keys))


def _topic_all_time_filter(topic: str | None):
    normalized_topic = _normalize_topic(topic)
    if normalized_topic is None or normalized_topic == "Global":
        return ~LeaderboardEntry.period_key.contains("::"), normalized_topic
    aliases = {normalized_topic, normalized_topic.lower()}
    if normalized_topic == "Technology":
        aliases.add("tech")
    return or_(*[LeaderboardEntry.period_key.like(f"%::{alias}") for alias in aliases]), normalized_topic


# ── Active Events ───────────────────────────────────────────────────────────

@router.get("/active-events", response_model=list[ActiveEventResponse])
async def get_active_events(session: SessionDep) -> list[ActiveEventResponse]:
    now = datetime.utcnow()
    result = await session.exec(
        select(XPMultiplierEvent).where(
            XPMultiplierEvent.is_active == True,  # noqa: E712
            XPMultiplierEvent.starts_at <= now,
            XPMultiplierEvent.ends_at >= now,
        )
    )
    return [_unwrap(r) for r in result.all()]


# ── Check-in ────────────────────────────────────────────────────────────────

@router.post("/check-in", response_model=CheckInResponse)
async def check_in(
    request: CheckInRequest,
    current_user: AuthUser,
    service: Service,
) -> CheckInResponse:
    repository = service._repository
    async with repository.session() as session:
        async with session.begin():
            # XP multiplier
            now_utc = datetime.utcnow()
            event_result = await session.exec(
                select(XPMultiplierEvent).where(
                    XPMultiplierEvent.is_active == True,  # noqa: E712
                    XPMultiplierEvent.starts_at <= now_utc,
                    XPMultiplierEvent.ends_at >= now_utc,
                )
            )
            event_rows = event_result.all()
            active_event = _unwrap(event_rows[0]) if event_rows else None

            if active_event:
                effective_xp = int(request.xp_amount * active_event.multiplier)
                bonus_xp = effective_xp - request.xp_amount
                event_name = active_event.name
            else:
                effective_xp = request.xp_amount
                bonus_xp = 0
                event_name = None

            today_str = now_utc.strftime("%Y-%m-%d")
            today_date = now_utc.date()
            period_key = get_period_key(today_date)
            normalized_topic = _normalize_topic(request.topic)

            # Daily progress
            dp_result = await session.exec(
                select(DailyProgress).where(
                    DailyProgress.user_id == current_user.id,
                    DailyProgress.date_key == today_str,
                )
            )
            daily_progress = _unwrap(dp_result.one_or_none())

            if daily_progress:
                daily_progress.xp_earned += effective_xp
                daily_progress.lessons_completed += 1
            else:
                daily_progress = DailyProgress(
                    user_id=current_user.id,
                    date_key=today_str,
                    xp_earned=effective_xp,
                    lessons_completed=1,
                    goal_met=False,
                )
                session.add(daily_progress)

            daily_progress.goal_met = daily_progress.xp_earned >= DAILY_GOAL_XP

            # Daily accuracy
            acc_result = await session.exec(
                select(DailyAccuracy).where(
                    DailyAccuracy.user_id == current_user.id,
                    DailyAccuracy.date_key == today_str,
                )
            )
            daily_accuracy = _unwrap(acc_result.one_or_none())
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

            # Streak
            new_streak = await update_streak_utc(session=session, user_id=current_user.id)

            # Leaderboard (global)
            leaderboard_entry = await session.get(LeaderboardEntry, (current_user.id, period_key))
            if leaderboard_entry:
                leaderboard_entry.total_xp += effective_xp
            else:
                leaderboard_entry = LeaderboardEntry(
                    user_id=current_user.id,
                    period_key=period_key,
                    total_xp=effective_xp,
                )
                session.add(leaderboard_entry)

            # Leaderboard (topic)
            if normalized_topic and normalized_topic != "Global":
                topic_pk = f"{period_key}::{normalized_topic}"
                topic_entry = await session.get(LeaderboardEntry, (current_user.id, topic_pk))
                if topic_entry:
                    topic_entry.total_xp += effective_xp
                else:
                    topic_entry = LeaderboardEntry(
                        user_id=current_user.id, period_key=topic_pk, total_xp=effective_xp,
                    )
                    session.add(topic_entry)

            # Topic mastery
            mastery_row = None
            if normalized_topic and normalized_topic != "Global":
                mastery_row = await session.get(TopicMastery, (current_user.id, normalized_topic))
                acc = request.accuracy_percentage if request.accuracy_percentage is not None else 0
                spd = request.completion_time_ms if request.completion_time_ms is not None else app_settings.MASTERY_SPEED_CEILING

                if mastery_row:
                    new_count = mastery_row.lesson_count + 1
                    mastery_row.total_xp += effective_xp
                    mastery_row.lesson_count = new_count
                    mastery_row.avg_accuracy += (acc - mastery_row.avg_accuracy) / new_count
                    mastery_row.avg_speed_ms += (spd - mastery_row.avg_speed_ms) / new_count
                else:
                    mastery_row = TopicMastery(
                        user_id=current_user.id,
                        topic=normalized_topic,
                        total_xp=effective_xp,
                        lesson_count=1,
                        avg_accuracy=float(acc),
                        avg_speed_ms=float(spd),
                    )
                    session.add(mastery_row)

                norm_xp = min(mastery_row.total_xp / app_settings.MASTERY_XP_CEILING, 1.0)
                speed_score = max(0.0, 1.0 - mastery_row.avg_speed_ms / app_settings.MASTERY_SPEED_CEILING)
                acc_score = mastery_row.avg_accuracy / 100.0
                mastery_row.mastery_score = (
                    app_settings.MASTERY_WEIGHT_XP * norm_xp
                    + app_settings.MASTERY_WEIGHT_ACC * acc_score
                    + app_settings.MASTERY_WEIGHT_SPD * speed_score
                )

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

            daily_progress.goal_met = daily_progress.xp_earned >= DAILY_GOAL_XP

            await session.flush()
            await session.refresh(daily_progress)

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
    )


# ── Daily Progress ──────────────────────────────────────────────────────────

@router.get("/daily-progress", response_model=CheckInResponse)
async def get_daily_progress(session: SessionDep, current_user: AuthUser) -> CheckInResponse:
    today_utc = datetime.now(timezone.utc)
    today_str = today_utc.strftime("%Y-%m-%d")

    daily_progress = _unwrap(
        (await session.exec(
            select(DailyProgress).where(
                DailyProgress.user_id == current_user.id, DailyProgress.date_key == today_str
            )
        )).one_or_none()
    )
    daily_accuracy = _unwrap(
        (await session.exec(
            select(DailyAccuracy).where(
                DailyAccuracy.user_id == current_user.id, DailyAccuracy.date_key == today_str
            )
        )).one_or_none()
    )
    gam = await session.get(UserGamification, current_user.id)
    current_streak = get_visible_streak_utc(gam)

    return CheckInResponse(
        user_id=current_user.id,
        date_key=today_str,
        xp_earned=daily_progress.xp_earned if daily_progress else 0,
        goal_met=daily_progress.goal_met if daily_progress else False,
        lessons_completed=daily_progress.lessons_completed if daily_progress else 0,
        high_accuracy_hits=daily_accuracy.high_accuracy_hits if daily_accuracy else 0,
        new_streak=current_streak,
    )


# ── Mastery ─────────────────────────────────────────────────────────────────

@router.get("/mastery/config", response_model=MasteryConfigResponse)
async def get_mastery_config(current_user: AuthUser) -> MasteryConfigResponse:
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


@router.get("/mastery", response_model=list[TopicMasteryResponse])
async def get_mastery(session: SessionDep, current_user: AuthUser) -> list[TopicMasteryResponse]:
    result = await session.exec(
        select(TopicMastery).where(TopicMastery.user_id == current_user.id)
    )
    return [TopicMasteryResponse.model_validate(_unwrap(r)) for r in result.all()]


# ── Leaderboard ─────────────────────────────────────────────────────────────

@router.get("/leaderboard", response_model=list[LeaderboardItem])
async def get_leaderboard(
    session: SessionDep,
    period_key: str | None = None,
    topic: str | None = Query(None),
    all_time: bool = Query(False),
) -> list[LeaderboardItem]:
    normalized_topic = _normalize_topic(topic)

    if all_time:
        if normalized_topic and normalized_topic != "Global":
            period_filter, _ = _topic_all_time_filter(normalized_topic)
        else:
            period_filter = ~LeaderboardEntry.period_key.contains("::")

        query = (
            select(LeaderboardEntry.user_id, func.sum(LeaderboardEntry.total_xp).label("total_xp"))
            .where(period_filter)
            .group_by(LeaderboardEntry.user_id)
            .order_by(func.sum(LeaderboardEntry.total_xp).desc())
            .limit(50)
        )
        result = await session.exec(query)
        items: list[LeaderboardItem] = []
        for idx, row in enumerate(result.all(), start=1):
            uid, xp = row[0], int(row[1])
            u = await session.get(User, uid)
            items.append(LeaderboardItem(rank=idx, name=u.name if u else "Unknown", total_xp=xp, user_id=uid))
        return items

    if period_key is None:
        period_key = get_current_utc_period_key()
    if normalized_topic and normalized_topic != "Global":
        topic_keys = _topic_period_keys(period_key, normalized_topic)
        query = (
            select(LeaderboardEntry.user_id, func.sum(LeaderboardEntry.total_xp).label("total_xp"))
            .where(LeaderboardEntry.period_key.in_(topic_keys))
            .group_by(LeaderboardEntry.user_id)
            .order_by(func.sum(LeaderboardEntry.total_xp).desc())
            .limit(50)
        )
        result = await session.exec(query)
        items: list[LeaderboardItem] = []
        for idx, row in enumerate(result.all(), start=1):
            uid, xp = row[0], int(row[1])
            u = await session.get(User, uid)
            items.append(LeaderboardItem(rank=idx, name=u.name if u else "Unknown", total_xp=xp, user_id=uid))
        return items

    query = (
        select(LeaderboardEntry)
        .where(LeaderboardEntry.period_key == period_key)
        .options(selectinload(LeaderboardEntry.user))
        .order_by(LeaderboardEntry.total_xp.desc())
        .limit(50)
    )
    result = await session.exec(query)
    entries = [_unwrap(r) for r in result.all()]
    return [
        LeaderboardItem(rank=i, name=e.user.name if e.user else "Unknown", total_xp=e.total_xp, user_id=e.user_id)
        for i, e in enumerate(entries, start=1)
    ]


@router.get("/leaderboard/me", response_model=MyRankResponse)
async def get_my_rank(
    session: SessionDep,
    current_user: AuthUser,
    period_key: str | None = Query(None, pattern=r"^WEEK-\d{4}-\d{2}$"),
    topic: str | None = Query(None),
    all_time: bool = Query(False),
) -> MyRankResponse:
    normalized_topic = _normalize_topic(topic)
    gam = await session.get(UserGamification, current_user.id)
    visible_streak = get_visible_streak_utc(gam)

    if all_time:
        if normalized_topic and normalized_topic != "Global":
            pf, _ = _topic_all_time_filter(normalized_topic)
        else:
            pf = ~LeaderboardEntry.period_key.contains("::")

        my_xp = int(_unwrap(
            (await session.exec(
                select(func.coalesce(func.sum(LeaderboardEntry.total_xp), 0)).where(
                    LeaderboardEntry.user_id == current_user.id, pf
                )
            )).one()
        ))

        subq = (
            select(LeaderboardEntry.user_id, func.sum(LeaderboardEntry.total_xp).label("total_xp"))
            .where(pf).group_by(LeaderboardEntry.user_id)
        ).subquery()
        higher = int(_unwrap(
            (await session.exec(select(func.count()).select_from(subq).where(subq.c.total_xp > my_xp))).one()
        ))
        return MyRankResponse(rank=higher + 1, total_xp=my_xp, current_streak=visible_streak, period_key="ALL_TIME")

    if period_key is None:
        today_utc = datetime.now(timezone.utc).date()
        period_key = get_period_key(today_utc)
        is_current = True
    else:
        is_current = period_key == get_period_key(datetime.now(timezone.utc).date())

    period_streak = visible_streak if is_current else await _get_period_streak(session, current_user.id, period_key)
    if normalized_topic and normalized_topic != "Global":
        topic_keys = _topic_period_keys(period_key, normalized_topic)
        my_xp = int(_unwrap(
            (await session.exec(
                select(func.coalesce(func.sum(LeaderboardEntry.total_xp), 0)).where(
                    LeaderboardEntry.user_id == current_user.id,
                    LeaderboardEntry.period_key.in_(topic_keys),
                )
            )).one()
        ))
        subq = (
            select(LeaderboardEntry.user_id, func.sum(LeaderboardEntry.total_xp).label("total_xp"))
            .where(LeaderboardEntry.period_key.in_(topic_keys))
            .group_by(LeaderboardEntry.user_id)
        ).subquery()
        higher = int(_unwrap(
            (await session.exec(select(func.count()).select_from(subq).where(subq.c.total_xp > my_xp))).one()
        ))
    else:
        entry = await session.get(LeaderboardEntry, (current_user.id, period_key))
        my_xp = entry.total_xp if entry else 0
        higher = int(_unwrap(
            (await session.exec(
                select(func.count()).select_from(LeaderboardEntry).where(
                    LeaderboardEntry.period_key == period_key, LeaderboardEntry.total_xp > my_xp
                )
            )).one()
        ))
    return MyRankResponse(rank=higher + 1, total_xp=my_xp, current_streak=period_streak, period_key=period_key, is_current_period=is_current)


# ── Proximity ───────────────────────────────────────────────────────────────

@router.get("/leaderboard/proximity", response_model=ProximityResponse)
async def get_proximity(
    current_user: AuthUser,
    session: SessionDep,
    topic: str | None = Query(None),
    all_time: bool = Query(False),
    xp_window: int = Query(200, ge=10, le=1000),
) -> ProximityResponse:
    normalized_topic = _normalize_topic(topic)

    if all_time:
        if normalized_topic and normalized_topic != "Global":
            pf, _ = _topic_all_time_filter(normalized_topic)
        else:
            pf = ~LeaderboardEntry.period_key.contains("::")

        my_xp = int(_unwrap(
            (await session.exec(
                select(func.coalesce(func.sum(LeaderboardEntry.total_xp), 0)).where(
                    LeaderboardEntry.user_id == current_user.id, pf
                )
            )).one()
        ))

        if my_xp == 0:
            return ProximityResponse(above=[], below=[], my_xp=0, my_rank=1)

        agg = (
            select(LeaderboardEntry.user_id, func.sum(LeaderboardEntry.total_xp).label("total_xp"))
            .where(pf).group_by(LeaderboardEntry.user_id)
        ).subquery()

        my_rank = int(_unwrap(
            (await session.exec(select(func.count()).select_from(agg).where(agg.c.total_xp > my_xp))).one()
        )) + 1

        above_rows = (await session.exec(
            select(agg.c.user_id, agg.c.total_xp)
            .where(agg.c.total_xp > my_xp, agg.c.total_xp <= my_xp + xp_window)
            .order_by(agg.c.total_xp.asc()).limit(5)
        )).all()
        below_rows = (await session.exec(
            select(agg.c.user_id, agg.c.total_xp)
            .where(agg.c.total_xp < my_xp, agg.c.total_xp >= my_xp - xp_window)
            .order_by(agg.c.total_xp.desc()).limit(5)
        )).all()

        async def _agg_neighbour(row):
            uid, xp = row[0], int(row[1])
            u = await session.get(User, uid)
            nrank = int(_unwrap(
                (await session.exec(select(func.count()).select_from(agg).where(agg.c.total_xp > xp))).one()
            )) + 1
            return ProximityNeighbour(user_id=str(uid), name=u.name if u else "Unknown", total_xp=xp, rank=nrank, xp_gap=abs(xp - my_xp))

        return ProximityResponse(
            above=[await _agg_neighbour(r) for r in above_rows],
            below=[await _agg_neighbour(r) for r in below_rows],
            my_xp=my_xp, my_rank=my_rank,
        )

    # Weekly
    period_key = get_current_utc_period_key()
    if normalized_topic and normalized_topic != "Global":
        topic_keys = _topic_period_keys(period_key, normalized_topic)
        my_xp = int(_unwrap(
            (await session.exec(
                select(func.coalesce(func.sum(LeaderboardEntry.total_xp), 0)).where(
                    LeaderboardEntry.user_id == current_user.id,
                    LeaderboardEntry.period_key.in_(topic_keys),
                )
            )).one()
        ))
        if my_xp == 0:
            return ProximityResponse(above=[], below=[], my_xp=0, my_rank=1)

        agg = (
            select(LeaderboardEntry.user_id, func.sum(LeaderboardEntry.total_xp).label("total_xp"))
            .where(LeaderboardEntry.period_key.in_(topic_keys))
            .group_by(LeaderboardEntry.user_id)
        ).subquery()
        my_rank = int(_unwrap(
            (await session.exec(select(func.count()).select_from(agg).where(agg.c.total_xp > my_xp))).one()
        )) + 1

        above_rows = (await session.exec(
            select(agg.c.user_id, agg.c.total_xp)
            .where(agg.c.total_xp > my_xp, agg.c.total_xp <= my_xp + xp_window)
            .order_by(agg.c.total_xp.asc()).limit(5)
        )).all()
        below_rows = (await session.exec(
            select(agg.c.user_id, agg.c.total_xp)
            .where(agg.c.total_xp < my_xp, agg.c.total_xp >= my_xp - xp_window)
            .order_by(agg.c.total_xp.desc()).limit(5)
        )).all()

        async def _topic_neighbour(row):
            uid, xp = row[0], int(row[1])
            u = await session.get(User, uid)
            nrank = int(_unwrap(
                (await session.exec(select(func.count()).select_from(agg).where(agg.c.total_xp > xp))).one()
            )) + 1
            return ProximityNeighbour(
                user_id=str(uid), name=u.name if u else "Unknown", total_xp=xp, rank=nrank, xp_gap=abs(xp - my_xp),
            )

        return ProximityResponse(
            above=[await _topic_neighbour(r) for r in above_rows],
            below=[await _topic_neighbour(r) for r in below_rows],
            my_xp=my_xp, my_rank=my_rank,
        )

    effective_pk = period_key
    entry = await session.get(LeaderboardEntry, (current_user.id, effective_pk))
    my_xp = entry.total_xp if entry else 0

    if my_xp == 0:
        return ProximityResponse(above=[], below=[], my_xp=0, my_rank=1)

    my_rank = int(_unwrap(
        (await session.exec(
            select(func.count()).select_from(LeaderboardEntry).where(
                LeaderboardEntry.period_key == effective_pk, LeaderboardEntry.total_xp > my_xp
            )
        )).one()
    )) + 1

    above_entries = [_unwrap(r) for r in (await session.exec(
        select(LeaderboardEntry)
        .where(LeaderboardEntry.period_key == effective_pk, LeaderboardEntry.total_xp > my_xp, LeaderboardEntry.total_xp <= my_xp + xp_window)
        .options(selectinload(LeaderboardEntry.user)).order_by(LeaderboardEntry.total_xp.asc()).limit(5)
    )).all()]
    below_entries = [_unwrap(r) for r in (await session.exec(
        select(LeaderboardEntry)
        .where(LeaderboardEntry.period_key == effective_pk, LeaderboardEntry.total_xp < my_xp, LeaderboardEntry.total_xp >= my_xp - xp_window)
        .options(selectinload(LeaderboardEntry.user)).order_by(LeaderboardEntry.total_xp.desc()).limit(5)
    )).all()]

    async def _neighbour(e):
        nrank = int(_unwrap(
            (await session.exec(
                select(func.count()).select_from(LeaderboardEntry).where(
                    LeaderboardEntry.period_key == effective_pk, LeaderboardEntry.total_xp > e.total_xp
                )
            )).one()
        )) + 1
        return ProximityNeighbour(
            user_id=str(e.user_id), name=e.user.name if e.user else "Unknown",
            total_xp=e.total_xp, rank=nrank, xp_gap=abs(e.total_xp - my_xp),
        )

    return ProximityResponse(
        above=[await _neighbour(e) for e in above_entries],
        below=[await _neighbour(e) for e in below_entries],
        my_xp=my_xp, my_rank=my_rank,
    )


# ── History & Stats ─────────────────────────────────────────────────────────

async def _zero_filled_history(session, user_id, days: int) -> list[HistoryEntry]:
    today = datetime.now(timezone.utc).date()
    start_date = today - timedelta(days=days - 1)
    result = await session.exec(
        select(DailyProgress).where(
            DailyProgress.user_id == user_id,
            DailyProgress.date_key >= start_date.isoformat(),
            DailyProgress.date_key <= today.isoformat(),
        )
    )
    data_map = {_unwrap(r).date_key: _unwrap(r) for r in result.all()}
    history: list[HistoryEntry] = []
    current = start_date
    while current <= today:
        key = current.isoformat()
        if key in data_map:
            dp = data_map[key]
            history.append(HistoryEntry(date_key=key, xp_earned=dp.xp_earned, goal_met=dp.goal_met, lessons_completed=dp.lessons_completed))
        else:
            history.append(HistoryEntry(date_key=key, xp_earned=0, goal_met=False, lessons_completed=0))
        current += timedelta(days=1)
    return history


@router.get("/history", response_model=list[HistoryEntry])
async def get_xp_history(
    current_user: AuthUser, session: SessionDep, days: int = Query(30, ge=7, le=365),
) -> list[HistoryEntry]:
    return await _zero_filled_history(session, current_user.id, days)


@router.get("/stats", response_model=StatsResponse)
async def get_stats(current_user: AuthUser, session: SessionDep) -> StatsResponse:
    history = await _zero_filled_history(session, current_user.id, 30)
    last_7 = history[-7:]
    seven_day_avg = sum(e.xp_earned for e in last_7) / 7
    goals_met = sum(1 for e in history if e.goal_met)
    completion_rate = goals_met / 30 * 100

    best_streak = current_run = 0
    for entry in history:
        if entry.xp_earned > 0:
            current_run += 1
            best_streak = max(best_streak, current_run)
        else:
            current_run = 0

    lifetime_xp = int(_unwrap(
        (await session.exec(
            select(func.coalesce(func.sum(DailyProgress.xp_earned), 0)).where(DailyProgress.user_id == current_user.id)
        )).one()
    ))
    return StatsResponse(
        seven_day_avg_xp=round(seven_day_avg, 1),
        thirty_day_best_streak=best_streak,
        completion_rate_30d=round(completion_rate, 1),
        lifetime_xp=lifetime_xp,
    )


# Prevent circular import at module level — use string annotation
from typing import TYPE_CHECKING
if TYPE_CHECKING:
    from server.service import Service as _Service
