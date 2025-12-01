from dataclasses import dataclass
from typing import Literal

from ulid import ULID

from server.core import Pipeline, Result, TranscriptGenerator, Transcripts
from server.repository import Repository
from server.store import Store


@dataclass(frozen=True, kw_only=True)
class TaskResult:
    pending: bool = True
    result: Result | Exception | None = None


class EchoService:
    def __init__(self, store: Store, repository: Repository):
        self.store = store
        self.repository = repository
        # Core Components
        self.pipeline = Pipeline()
        self.transcript_generator = TranscriptGenerator()

        self._results: dict[ULID, TaskResult] = {}

    async def generate(self) -> Transcripts:
        transcripts = await self.transcript_generator()
        await self.store.dump_transcripts(transcripts)
        return transcripts

    async def analyze(self, audio: bytes, tid: ULID) -> None:
        if (transcript := await self.store.get_transcript(tid)) is not None:
            self._results[tid] = TaskResult()
            try:
                result = await self.pipeline(audio, transcript)
            except Exception as e:
                result = e
            self._results[tid] = TaskResult(pending=False, result=result)

    async def result(self, tid: ULID) -> TaskResult | None | Literal[False]:
        if await self.store.get_transcript(tid) is None:
            return False
        return self._results.get(tid)
