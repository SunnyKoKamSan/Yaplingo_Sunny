from datetime import timedelta
from typing import TYPE_CHECKING, Annotated, Awaitable, cast

from pydantic import ConfigDict, Field, computed_field
from redis.asyncio import Redis
from typing_extensions import Self
from ulid import ULID

from server.core import Transcript, Transcripts

if TYPE_CHECKING:
    cached_property = property
else:
    from functools import cached_property


TRANSCRIPT_TTL = timedelta(hours=1)


class EchoSession(Transcripts):
    uid: Annotated[ULID, Field(exclude=True)]
    progress: int = 0
    attempts: list[int] = []

    model_config = ConfigDict(frozen=True)

    def __repr__(self) -> str:
        return f"echo:{str(self.uid)}"

    @classmethod
    def init(cls, uid: ULID, transcripts: Transcripts) -> Self:
        return cls(**transcripts.model_dump(), uid=uid, attempts=[0] * len(transcripts.items))

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
        return self.attempts[self.progress]


class EchoStore:
    def __init__(self, client: Redis):
        self._client = client

    async def dump_session(self, session: EchoSession) -> EchoSession:
        pipe = self._client.pipeline()
        pipe.json().set(
            repr(session),
            "$",
            session.model_dump(
                mode="json",
                exclude={"total", "transcript", "attempted"},
            ),
        )
        pipe.expire(repr(session), TRANSCRIPT_TTL)
        await pipe.execute()
        return session

    async def get_session(self, uid: ULID) -> EchoSession | None:
        op = self._client.json().get(f"echo:{str(uid)}")
        data = await cast(Awaitable[dict | None], op)
        return EchoSession(**data, uid=uid) if data else None

    async def increment_session_progress(self, session: EchoSession) -> None:
        path = "$.progress"
        op = self._client.json().numincrby(repr(session), path, 1)
        await cast(Awaitable[str], op)

    async def increment_session_attempts(self, session: EchoSession) -> None:
        path = f"$.attempts[{session.progress}]"
        op = self._client.json().numincrby(repr(session), path, 1)
        await cast(Awaitable[str], op)

    async def delete_session(self, session: EchoSession) -> None:
        op = self._client.delete(repr(session))
        await cast(Awaitable[int], op)


__all__ = ["EchoStore", "EchoSession"]
