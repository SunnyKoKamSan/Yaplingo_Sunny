from datetime import datetime
from zoneinfo import ZoneInfo

from server.repository.entities import User
from server.store.chat import ChatSessionState
from server.store.echo import EchoSessionState

ECHO_SESSION_PRICE_BASE = 50


def get_echo_session_expense(session: EchoSessionState) -> int:
    extras = sum(session.chances) - len(session.scenario.transcripts)
    return sum((i + 1) * ECHO_SESSION_PRICE_BASE for i in range(extras))


def get_echo_session_points(session: EchoSessionState) -> int:
    scores = [max(a.pronunciation.score for a in attempts) if attempts else 0 for attempts in session.attempts]
    return int(sum(scores) * 100)


def calculate_chat_turn_score(turn: ChatSessionState.Turn) -> float:
    return (
        turn.pronunciation.score * 0.4
        + turn.evaluation.criteria.accuracy * 0.3
        + turn.evaluation.criteria.appropriacy * 0.3
    )


def get_chat_session_points(session: ChatSessionState) -> int:
    points = sum(1 for t in session.tasks if t.completed) * 133
    points += sum(round(t.score * 100) for t in session.turns) // len(session.turns)
    return points


def get_user_streak_milestone(user: User) -> int:
    tz = ZoneInfo(user.timezone)
    dt = datetime.now(tz).replace(month=1, day=1).astimezone(ZoneInfo("UTC"))

    streak_factor = 1.08**user.streak
    day_factor = 1 + (dt.day - 1) / 60.0

    xp_raw = 100 * streak_factor * day_factor
    xp_rounded = round(xp_raw / 10) * 10
    xp_required = max(50, min(xp_rounded, 1000))

    return xp_required
