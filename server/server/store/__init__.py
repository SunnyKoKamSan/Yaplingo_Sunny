from datetime import timedelta
from typing import Awaitable, cast

from redis.asyncio import Redis as AsyncRedis
from ulid import ULID

from server.core import Transcript, Transcripts

from .settings import settings

TRANSCRIPT_TTL = timedelta(hours=1)


class Store:
    def __init__(self):
        self.client = AsyncRedis.from_url(str(settings.url), decode_responses=True)

    @classmethod
    async def create(cls):
        return cls()

    async def dispose(self):
        await self.client.aclose()

    async def dump_transcripts(self, transcripts: Transcripts) -> None:
        pipe = self.client.pipeline()
        for transcript in transcripts.items:
            # `mode="json"` ensures `id: ULID` is serialized as a string
            mapping = transcript.model_dump(mode="json")  # dict
            pipe.hsetex(
                f"transcript:{str(transcript.id)}",
                ex=TRANSCRIPT_TTL,
                mapping=mapping,
            )
        await pipe.execute()

    async def get_transcript(self, tid: ULID) -> Transcript | None:
        hgetall = self.client.hgetall(f"transcript:{str(tid)}")
        mapping = await cast(Awaitable[dict], hgetall)
        return Transcript.model_validate(mapping) if mapping else None
