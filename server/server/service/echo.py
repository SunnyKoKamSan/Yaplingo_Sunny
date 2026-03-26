import base64
import hashlib
from typing import Literal, Optional, cast, overload

from server.broker import Broker
from server.broker.tasks import analyze_echo
from server.core import EchoPipeline
from server.core.models.echo import Result
from server.repository import Repository
from server.repository.models import EchoSession, User
from server.store import Store
from server.store.echo import EchoSessionState


class EchoService:
    def __init__(self, broker: Broker, store: Store, repository: Repository):
        self.broker = broker
        self.store = store
        self.repository = repository
        self.pipeline = EchoPipeline()

    @overload
    async def session(self, user: User, generate: Literal[True]) -> "SessionDelegate": ...
    @overload
    async def session(self, user: User, generate: Literal[False] = False) -> Optional["SessionDelegate"]: ...

    async def session(self, user: User, generate: bool = False) -> Optional["SessionDelegate"]:
        session = await self.store.echo.get_session(user.id)
        if session is None and generate:
            scenario = await self.pipeline()
            session = EchoSessionState(scenario=scenario).with_uid(user.id)
            session = await self.store.echo.stash_session(session)
        session = cast(EchoSessionState, session)
        return EchoService.SessionDelegate(state=session, _service=self)

    class SessionDelegate:
        def __init__(self, state: EchoSessionState, _service: "EchoService"):
            self.state = state
            self._service = _service

        async def prepare(self) -> None:
            if not self.state.completed:
                await self.state.transcript.get_audio()

        async def refresh(self) -> None:
            session = await self._service.store.echo.get_session(self.state._uid)
            assert session is not None, "session deleted unexpectedly"
            self.state = session

        async def attempt(self, audio: bytes) -> EchoSessionState.Attempt | None:
            assert not self.state.completed, "session already completed"
            audio_b64 = base64.b64encode(audio)
            audio_md5 = hashlib.md5(audio).hexdigest()
            result = await self._service.broker.execute(
                analyze_echo,
                task_id=f"{repr(self.state)}:pipeline::{audio_md5}",
                audio_b64=audio_b64.decode(),
                session=self.state,
            )
            result = cast(Result | None, result)
            if result is not None:
                attempt = EchoSessionState.Attempt(
                    **result.model_dump(exclude={"pronunciation"}),
                    pronunciation=result.pronunciation.with_transcript(self.state.transcript),
                )
                await self._service.store.echo.record_session_attempt(self.state, attempt)
                return attempt

        async def proceed(self) -> None:
            assert not self.state.completed, "session already completed"
            await self._service.store.echo.increment_session_progress(self.state)

        async def complete(self) -> EchoSessionState.Summary:
            await self._service.repository.echo.save(EchoSession.from_state(self.state))
            await self._service.store.echo.discard_session(self.state)
            return self.state.summary  # TODO: add points to user in repository

        async def abort(self) -> None:
            await self._service.store.echo.discard_session(self.state)


__all__ = ["EchoService"]
