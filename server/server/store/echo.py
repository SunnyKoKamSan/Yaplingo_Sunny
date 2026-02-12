from datetime import timedelta
from typing import TYPE_CHECKING, Annotated, Awaitable, cast

from pydantic import Base64Bytes, BaseModel, ConfigDict, Field, computed_field
from redis.asyncio import Redis
from typing_extensions import Self
from ulid import ULID

from server.core import Result, Transcript, Transcripts

if TYPE_CHECKING:
    cached_property = property
else:
    from functools import cached_property

SESSION_TTL = timedelta(hours=1)


class EchoSessionState(Transcripts):
    class Attempt(BaseModel):
        audio_b64: Annotated[Base64Bytes, Field(alias="audio", repr=False)]
        result: Result

        model_config = ConfigDict(frozen=True)

    uid: Annotated[ULID, Field(exclude=True)]
    progress: int = 0
    attempts: list[list[Attempt]]

    model_config = ConfigDict(frozen=True)

    def __repr__(self) -> str:
        return f"echo:{str(self.uid)}"

    @classmethod
    def init(cls, uid: ULID, transcripts: Transcripts) -> Self:
        return cls(
            **transcripts.model_dump(),
            uid=uid,
            attempts=[[] for _ in range(len(transcripts.items))],
        )

    @classmethod
    def load(cls, uid: ULID, **data) -> Self:
        self = cls(**data, uid=uid)
        # recover the `_transcript` private field in `Pronunciation` for each attempt result
        #   because it was excluded from serialization to the store
        for index, attempts in enumerate(self.attempts):
            for attempt in attempts:
                attempt.result.pronunciation.with_transcript(self.items[index])
        return self

    @computed_field
    @cached_property
    def total(self) -> int:
        return len(self.items)

    @computed_field
    @cached_property
    def transcript(self) -> Transcript:
        return self.items[self.progress]

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
        return EchoSessionState.load(uid=uid, **data) if data else None

    async def increment_session_progress(self, session: EchoSessionState) -> None:
        op = self._client.json().numincrby(repr(session), "$.progress", 1)
        await cast(Awaitable[str], op)

    async def stash_session_attempt(self, session: EchoSessionState, attempt: EchoSessionState.Attempt) -> None:
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
        op = self._client.delete(repr(session))
        await cast(Awaitable[int], op)


__all__ = ["EchoStore", "EchoSessionState"]
