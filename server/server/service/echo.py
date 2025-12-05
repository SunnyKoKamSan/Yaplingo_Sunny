import base64
from typing import Literal

from ulid import ULID

from server.broker import Broker
from server.broker.tasks import analyze_echo, synthesize_tts
from server.core import Result, TranscriptGenerator, Transcripts
from server.repository import Repository
from server.store import Store


class EchoService:
    def __init__(self, broker: Broker, store: Store, repository: Repository):
        self.broker = broker
        self.store = store
        self.repository = repository
        self.transcript_generator = TranscriptGenerator()

    async def generate(self) -> Transcripts:
        transcripts = await self.transcript_generator()
        await self.store.dump_transcripts(transcripts)
        return transcripts

    async def analyze(self, audio: bytes, tid: ULID) -> Result | None | Literal[False]:
        if (transcript := await self.store.get_transcript(tid)) is not None:
            audio_b64 = base64.b64encode(audio).decode("utf-8")
            return await self.broker.execute(
                analyze_echo,
                model=Result,
                id=tid,
                audio_b64=audio_b64,
                transcript=transcript,
            )
        return False

    async def synthesize_feedback_audio(self, tid: ULID) -> str | None:
        if await self.store.get_transcript(tid) is not None:
            task_result = await self.broker.retrieve(tid, Result)
            result = task_result.value if task_result is not None else None
            if isinstance(result, Result):
                return await self.broker.execute(
                    synthesize_tts,
                    text=result.feedback,
                )
