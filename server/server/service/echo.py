import base64
import hashlib
from typing import Literal, cast, overload

from server.broker import Broker
from server.broker.tasks import analyze_echo, synthesize_tts
from server.core import Result, TranscriptGenerator
from server.repository import Repository
from server.repository.models import User
from server.store import Store
from server.store.echo import EchoSession


class EchoService:
    def __init__(self, broker: Broker, store: Store, repository: Repository):
        self.broker = broker
        self.store = store
        self.repository = repository
        self.transcript_generator = TranscriptGenerator()

    @overload
    async def load_session(self, user: User, generate: Literal[True] = True) -> EchoSession: ...
    @overload
    async def load_session(self, user: User, generate: Literal[False]) -> EchoSession | None: ...
    async def load_session(self, user: User, generate: bool = True) -> EchoSession | None:
        session = await self.store.echo.get_session(user.id)
        if session is None and generate:
            transcripts = await self.transcript_generator()
            session = EchoSession.init(user.id, transcripts)
            return await self.store.echo.dump_session(session)
        return session

    async def submit_attempt(self, session: EchoSession, audio: bytes) -> Result | None:
        audio_b64 = base64.b64encode(audio).decode("utf-8")
        audio_md5 = hashlib.md5(audio).hexdigest()
        result = await self.broker.execute(
            analyze_echo,
            task_id=f"{repr(session)}:pipeline::{audio_md5}",
            audio_b64=audio_b64,
            transcript=session.transcript,
        )
        result = cast(Result | None, result)
        if result is not None:
            await self.store.echo.increment_session_attempts(session)
            feedback_md5 = hashlib.md5(result.feedback.encode("utf-8")).hexdigest()
            await self.broker.delegate(
                synthesize_tts,
                task_id=f"{repr(session)}:fbtts::{feedback_md5}",
                text=result.feedback,
            )
            return result

    async def proceed_session(self, session: EchoSession) -> bool:
        if session.progress < len(session.items) - 1:
            await self.store.echo.increment_session_progress(session)
            return True
        await self.store.echo.delete_session(session)
        # TODO: handle session completion
        return False

    async def abort_session(self, session: EchoSession) -> None:
        await self.store.echo.delete_session(session)

    async def retrieve_fbtts(self, session: EchoSession, result: Result) -> str:
        feedback_md5 = hashlib.md5(result.feedback.encode("utf-8")).hexdigest()
        task_id = f"{repr(session)}:fbtts::{feedback_md5}"
        fbtts = await self.broker.recall(synthesize_tts, task_id=task_id)
        return cast(str, fbtts)


__all__ = ["EchoService"]
