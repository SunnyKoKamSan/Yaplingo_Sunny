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

    async def get(self, id: ULID, check_streak: bool = True) -> User | None:
        user = await self.repository.user.get_one(id)
        # reset streak if over 1 day gap since last streak (in user's timezone)
        if check_streak and user is not None and user.streak > 0:
            tz = ZoneInfo(user.timezone)
            today = datetime.now(tz).date()
            streaked_date = user.streaked_at.astimezone(tz).date()
            if today - streaked_date > timedelta(days=1):
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


__all__ = ["UserService", "UserCredentials", "UserCreation", "UserInsightsWithSummary"]
