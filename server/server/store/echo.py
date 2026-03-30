from datetime import timedelta
from typing import TYPE_CHECKING, Any, Awaitable, cast

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    PrivateAttr,
    computed_field,
)
from redis.asyncio import Redis
from typing_extensions import Self
from ulid import ULID

from server.core.models.echo import Result, Scenario, Transcript
from server.repository.entities import EchoAttempt, EchoSession

if TYPE_CHECKING:
    cached_property = property
else:
    from functools import cached_property

SESSION_TTL = timedelta(hours=1)


class EchoSessionState(BaseModel):
    class Attempt(Result): ...

    class Summary(BaseModel):
        points: int

    _uid: ULID = PrivateAttr()

    scenario: Scenario
    progress: int = 0
    attempts: list[list[Attempt]] = Field(
        default_factory=lambda data: [[] for _ in range(len(data["scenario"].transcripts))]
    )

    model_config = ConfigDict(frozen=True)

    def __repr__(self) -> str:
        return f"echo:{str(self._uid)}"

    def model_post_init(self, context: Any) -> None:
        super().model_post_init(context)
        # recover the `_transcript` private field in `Pronunciation` for each attempt result
        #   because it was excluded from serialization to the store (Pydantic's private attribute)
        for index, attempts in enumerate(self.attempts):
            for attempt in attempts:
                attempt.pronunciation.with_transcript(self.scenario.transcripts[index])

    def with_uid(self, uid: ULID) -> Self:
        self._uid = uid
        return self

    @computed_field
    @cached_property
    def total(self) -> int:
        return len(self.scenario.transcripts)

    @computed_field
    @cached_property
    def completed(self) -> bool:
        # when `progress` (zero-based) exceeds `total`,
        # needs final proceed to increment progress to equal `total` to mark completion
        return self.progress >= self.total

    @cached_property
    def transcript(self) -> Transcript:
        assert not self.completed, "session already completed"
        return self.scenario.transcripts[self.progress]

    @cached_property
    def summary(self) -> Summary:
        assert self.completed, "session not completed yet"
        from server import formula

        points = formula.get_echo_session_points(self)
        return EchoSessionState.Summary(points=points)

    def entity(self) -> EchoSession:
        s = EchoSession(
            user_id=self._uid,
            topic=self.scenario.topic,
            scenario=self.scenario.scenario,
            points=self.summary.points,
            transcripts=[t.text for t in self.scenario.transcripts],
        )
        s.attempts = [
            EchoAttempt(
                session_id=s.id,
                index=index,
                audio=attempt.audio,
                feedback=attempt.feedback,
                pronunciation=attempt.pronunciation.model_dump(
                    mode="json",
                    exclude_computed_fields=True,
                ),
            )
            for index, attempts in enumerate(self.attempts)
            for attempt in attempts
        ]
        return s


class EchoStore:
    def __init__(self, client: Redis):
        self._client = client

    async def stash_session(self, session: EchoSessionState) -> EchoSessionState:
        pipe = self._client.pipeline()
        pipe.json().set(
            repr(session),
            "$",
            session.model_dump(
                mode="json",
                exclude_computed_fields=True,
            ),
        )
        pipe.expire(repr(session), SESSION_TTL)
        await pipe.execute()
        return session

    async def get_session(self, uid: ULID) -> EchoSessionState | None:
        op = self._client.json().get(f"echo:{str(uid)}")
        data = await cast(Awaitable[dict | None], op)
        if data is not None:
            return EchoSessionState(**data).with_uid(uid)

    async def increment_session_progress(self, session: EchoSessionState) -> None:
        op = self._client.json().numincrby(repr(session), "$.progress", 1)
        await cast(Awaitable[str], op)

    async def record_session_attempt(self, session: EchoSessionState, attempt: EchoSessionState.Attempt) -> None:
        op = self._client.json().arrappend(
            repr(session),
            f"$.attempts[{session.progress}]",
            attempt.model_dump(
                mode="json",
                exclude_computed_fields=True,
            ),
        )
        await cast(Awaitable[list[int | None]], op)

    async def discard_session(self, session: EchoSessionState) -> None:
        await self._client.delete(repr(session))


__all__ = ["EchoStore", "EchoSessionState"]
