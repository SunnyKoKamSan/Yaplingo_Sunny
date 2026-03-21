from datetime import timedelta
from typing import TYPE_CHECKING, Annotated, Any, Awaitable, cast

from pydantic import Base64Bytes, BaseModel, ConfigDict, Field, PrivateAttr, computed_field
from redis.asyncio import Redis
from typing_extensions import Self
from ulid import ULID

from server.core.models.echo import Result, Scenario, Transcript

if TYPE_CHECKING:
    cached_property = property
else:
    from functools import cached_property

SESSION_TTL = timedelta(hours=1)


class EchoSessionState(BaseModel):
    class Attempt(Result):
        audio_b64: Annotated[
            Base64Bytes,
            Field(
                serialization_alias="audio",
                repr=False,
            ),
        ]

        model_config = ConfigDict(frozen=True)

    topic: str
    scenario: str
    transcripts: list[Transcript]

    _uid: Annotated[ULID, PrivateAttr()]

    progress: int = 0
    attempts: list[list[Attempt]]

    model_config = ConfigDict(frozen=True)

    def __repr__(self) -> str:
        return f"echo:{str(self._uid)}"

    def model_post_init(self, context: Any) -> None:
        super().model_post_init(context)
        # recover the `_transcript` private field in `Pronunciation` for each attempt result
        #   because it was excluded from serialization to the store
        for index, attempts in enumerate(self.attempts):
            for attempt in attempts:
                attempt.pronunciation.with_transcript(self.transcripts[index])

    @classmethod
    def new(cls, uid: ULID, scenario: Scenario) -> Self:
        return cls(
            **scenario.model_dump(),
            attempts=[[] for _ in range(len(scenario.transcripts))],
        ).with_uid(uid)

    def with_uid(self, uid: ULID) -> Self:
        self._uid = uid
        return self

    @computed_field
    @cached_property
    def total(self) -> int:
        return len(self.transcripts)

    @computed_field
    @cached_property
    def transcript(self) -> Transcript:
        return self.transcripts[self.progress]

    @computed_field
    @cached_property
    def attempted(self) -> int:
        if self.progress >= len(self.attempts):
            return 0
        return len(self.attempts[self.progress])


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
