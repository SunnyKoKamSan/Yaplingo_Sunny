from collections import Counter
from datetime import datetime, timedelta, timezone
from typing import Annotated
from zoneinfo import ZoneInfo

from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError
from pydantic import BaseModel, Field
from pydantic_extra_types.language_code import LanguageAlpha2
from pydantic_extra_types.timezone_name import TimeZoneName
from ulid import ULID

from server.core.generators.user import InsightsGenerator
from server.core.models import Insights
from server.repository import Repository
from server.repository.entities import User
from server.store import Store


class UserCredentials(BaseModel):
    name: str
    password: str


class UserCreation(BaseModel):
    name: Annotated[str, Field(min_length=2, max_length=32, pattern=r"^[a-z0-9._]+$")]
    password: Annotated[str, Field(min_length=8, max_length=128)]
    language: Annotated[LanguageAlpha2, Field(default=LanguageAlpha2("en"))]
    timezone: Annotated[TimeZoneName, Field(default=TimeZoneName("UTC"))]


class UserInsightsWithSummary(BaseModel):
    insights: Insights
    summary: str


class UserStatistics(BaseModel):
    class ProgressEntry(BaseModel):
        date: datetime
        points: int
        count: int

    progress: list[ProgressEntry]
    average_points_7d: float
    best_streak_30d: int
    total_points_30d: int
    completion_rate_30d: float


class UserService:
    hasher = PasswordHasher()

    def __init__(self, store: Store, repository: Repository):
        self.store = store
        self.repository = repository
        self._insights_generator = InsightsGenerator()

    async def verify(self, credentials: UserCredentials) -> User | None:
        if (user := await self.repository.user.get_one(credentials.name)) is not None:
            try:
                self.hasher.verify(user.password, credentials.password)
            except VerifyMismatchError:
                return None
            return user

    async def create(self, creation: UserCreation) -> User:
        password = self.hasher.hash(creation.password)
        user = User(**creation.model_dump(exclude={"password"}), password=password)
        return await self.repository.user.dump(user)

    async def get(self, id: ULID, check_streak: bool = False) -> User | None:
        user = await self.repository.user.get_one(id)
        # reset streak if over 1 day gap since last streak (in user's timezone)
        if check_streak and user is not None and user.streak > 0:
            tz = ZoneInfo(user.timezone)
            today = datetime.now(tz).date()
            streaked_date = user.streaked_at.astimezone(tz).date()
            if today - streaked_date > timedelta(days=1):
                if user.streak_freezes > 0:
                    await self.repository.user.consume_streak_freeze(user)
                else:
                    await self.repository.user.reset_streak(user)
        return user

    async def get_insights(self, user: User) -> Insights | None:
        """Get cached insights or compute fresh ones. Used by scenario generators."""
        insights = await self.store.user.get_insights(user)
        if insights is not None:
            return insights
        insights = await self._extract_insights(user)
        if insights is not None:
            await self.store.user.set_insights(user, insights)
        return insights

    async def get_insights_with_summary(self, user: User) -> UserInsightsWithSummary | None:
        """
        Generate pronunciation insights summary based on user's recent sessions.
        Analyzes pronunciation data from Echo and Chat sessions over the last 30 days.
        """
        insights = await self.get_insights(user)
        if insights is None:
            return None

        summary = await self.store.user.get_insights_summary(user)
        if summary is None:
            # generate a new summary via LLM and cache it
            summary = await self._insights_generator(insights)
            await self.store.user.set_insights_summary(user, summary)
        return UserInsightsWithSummary(insights=insights, summary=summary)

    # TODO: to be improved
    async def _extract_insights(self, user: User) -> Insights | None:
        """Core insights extraction from user's last 30 days of sessions."""

        echo_sessions, chat_sessions = await self.repository.aggregation.get_sessions_with_pronunciation_by_user(
            user, start=datetime.now(timezone.utc) - timedelta(days=30)
        )

        scores: list[float] = []
        word_scores: dict[str, list[float]] = {}  # word -> list of scores
        phoneme_error_counter: Counter[tuple[str, str | None, str | None, str]] = Counter()

        def extract_pronunciation_errors(pronunciation: dict):
            if "score" in pronunciation:
                scores.append(float(pronunciation["score"]))

            for diff in pronunciation.get("differences", []):
                word = diff.get("word", "")
                operation = diff.get("operation", "")
                expected = diff.get("expected")
                predicted = diff.get("predicted")
                opname = {"~": "replace", "+": "insert", "-": "delete"}.get(operation, "")
                phoneme = expected or predicted or ""
                phoneme_error_counter[(phoneme, expected, predicted, opname)] += 1

                if word and word not in word_scores:
                    word_scores[word] = []

            for word, word_span in pronunciation.get("words", []):
                if isinstance(word_span, dict) and "score" in word_span:
                    if word not in word_scores:
                        word_scores[word] = []
                    word_scores[word].append(float(word_span["score"]))

        for session in echo_sessions:
            for attempt in session.attempts:
                pronunciation = attempt.pronunciation
                if pronunciation:
                    extract_pronunciation_errors(pronunciation)

        for session in chat_sessions:
            for turn in session.turns:
                pronunciation = turn.pronunciation
                if pronunciation:
                    extract_pronunciation_errors(pronunciation)

        # build top phoneme errors (top 10)
        top_phoneme_errors = [
            Insights.PhonemeError(
                phoneme=phoneme,
                expected=expected,
                predicted=predicted,
                operation=opname,
                count=count,
            )
            for (phoneme, expected, predicted, opname), count in phoneme_error_counter.most_common(10)
        ]

        # build problematic words (top 10 by error count, with avg score)
        word_error_counts = {word: len(scores_list) for word, scores_list in word_scores.items() if scores_list}
        top_word_errors = [
            Insights.WordError(
                word=word,
                average=sum(word_scores[word]) / len(word_scores[word]) if word_scores[word] else 0.0,
                count=word_error_counts.get(word, 0),
            )
            for word in sorted(word_scores.keys(), key=lambda w: word_error_counts.get(w, 0), reverse=True)[:10]
            if word_scores[word]  # only include words with scores
        ]

        # count total attempts
        total_attempts = sum(len(s.attempts) for s in echo_sessions) + sum(len(s.turns) for s in chat_sessions)
        if total_attempts == 0 or not scores:
            return None

        return Insights(
            average=sum(scores) / len(scores),
            phoneme_errors=top_phoneme_errors,
            word_errors=top_word_errors,
        )

    async def get_points_progress(self, user: User, days: int = 30) -> list[UserStatistics.ProgressEntry]:
        tz = ZoneInfo(user.timezone)
        today = datetime.now(tz).date()
        start = today - timedelta(days=days - 1)
        start = datetime(start.year, start.month, start.day, tzinfo=tz)
        end = datetime(today.year, today.month, today.day, tzinfo=tz) + timedelta(days=1)

        sessions = await self.repository.aggregation.get_sessions_by_user(user, start=start, end=end)

        daily_points: dict[str, int] = {}
        daily_sessions: dict[str, int] = {}
        for s in sessions:
            key = s.completed_at.astimezone(tz).date().isoformat()
            daily_points[key] = daily_points.get(key, 0) + s.points
            daily_sessions[key] = daily_sessions.get(key, 0) + 1

        progress: list[UserStatistics.ProgressEntry] = []
        current = start
        while current <= end:
            key = current.date().isoformat()
            progress.append(
                UserStatistics.ProgressEntry(
                    date=current,
                    points=daily_points.get(key, 0),
                    count=daily_sessions.get(key, 0),
                )
            )
            current += timedelta(days=1)
        return progress

    async def get_stats(self, user: User) -> UserStatistics:
        progress = await self.get_points_progress(user, 30)

        last_7_days = progress[-7:]
        average_points = sum(e.points for e in last_7_days) / 7
        active_days = sum(1 for e in progress if e.count > 0)
        completion_rate = (active_days / 30) * 100

        best_streak = current_run = 0
        for entry in progress:
            if entry.points > 0:
                current_run += 1
                best_streak = max(best_streak, current_run)
            else:
                current_run = 0

        total_points = sum(e.points for e in progress)

        return UserStatistics(
            progress=progress,
            average_points_7d=round(average_points, 1),
            best_streak_30d=best_streak,
            total_points_30d=total_points,
            completion_rate_30d=round(completion_rate, 1),
        )


__all__ = ["UserService", "UserCredentials", "UserCreation", "UserInsightsWithSummary", "UserStatistics"]
