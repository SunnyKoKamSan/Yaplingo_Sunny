import base64

from ulid import ULID

from server.broker import Broker
from server.broker.tasks import analyze_echo
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

    async def analyze(self, audio: bytes, tid: ULID) -> bool:
        if (transcript := await self.store.get_transcript(tid)) is not None:
            audio_b64 = base64.b64encode(audio).decode("utf-8")
            await self.broker.kickstart(
                analyze_echo,
                id=tid,
                audio_b64=audio_b64,
                transcript=transcript,
            )
            return True
        return False

    async def result(self, tid: ULID) -> Result | None | BaseException | bool:
        if await self.store.get_transcript(tid) is None:
            return False  # transcript does not exist
        task = await self.broker.retrieve(tid, Result)
        if task is None:
            return True  # task is still pending
        if task.error is not None:
            return task.error
        return task.value
