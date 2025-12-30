from datetime import timedelta
from typing import Awaitable, cast

from pydantic import TypeAdapter
from redis.asyncio import Redis as AsyncRedis
from ulid import ULID

from ..core.generators.transcript import Transcript
from .settings import settings

TranscriptModel = TypeAdapter(Transcript)

TRANSCRIPT_TTL = timedelta(hours=1)


class Store:
    def __init__(self):
        self._client = AsyncRedis.from_url(str(settings.url), decode_responses=True)

    @classmethod
    async def create(cls):
        return cls()

    async def dispose(self):
        return await self._client.aclose()

    async def save_transcript(self, transcript: Transcript):
        # `mode="json"` ensures `id: ULID` is serialized as a string
        mapping = TranscriptModel.dump_python(transcript, mode="json")
        hsetex = self._client.hsetex(
            f"transcript:{str(transcript.id)}",
            ex=TRANSCRIPT_TTL,
            mapping=mapping,
        )
        await cast(Awaitable[int], hsetex)

    async def get_transcript(self, tid: ULID) -> Transcript | None:
        hgetall = self._client.hgetall(f"transcript:{str(tid)}")
        mapping = await cast(Awaitable[dict], hgetall)
        return TranscriptModel.validate_python(mapping) if mapping else None
