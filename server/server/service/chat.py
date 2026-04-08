import base64
import hashlib
from typing import Literal, Optional, cast, overload

from server.broker import Broker
from server.broker.tasks import process_chat
from server.core import ChatPipeline
from server.core.models.chat import Result
from server.repository import Repository
from server.repository.entities import User
from server.store import Store
from server.store.chat import ChatSessionState


class ChatService:
    def __init__(self, broker: Broker, store: Store, repository: Repository):
        self.broker = broker
        self.store = store
        self.repository = repository
        self.pipeline = ChatPipeline()

    @overload
    async def session(self, user: User, generate: Literal[True]) -> "SessionDelegate": ...
    @overload
    async def session(self, user: User, generate: Literal[False] = False) -> Optional["SessionDelegate"]: ...

    async def session(self, user: User, generate: bool = False) -> Optional["SessionDelegate"]:
        session = await self.store.chat.get_session(user.id)
        if session is None and generate:
            scenario = await self.pipeline()
            session = ChatSessionState(scenario=scenario).with_uid(user.id)
            session = await self.store.chat.stash_session(session)
        if session is None:
            return None
        return ChatService.SessionDelegate(user=user, state=session, _service=self)

    class SessionDelegate:
        def __init__(self, user: User, state: ChatSessionState, _service: "ChatService"):
            self.user = user
            self.state = state
            self._service = _service

        async def refresh(self) -> None:
            session = await self._service.store.chat.get_session(self.state._uid)
            assert session is not None, "session deleted unexpectedly"
            self.state = session

        async def turn(self, audio: bytes) -> ChatSessionState.Turn | None:
            assert not self.state.finished, "session already finished"
            audio_b64 = base64.b64encode(audio)
            audio_md5 = hashlib.md5(audio).hexdigest()
            result = await self._service.broker.execute(
                process_chat,
                task_id=f"{repr(self.state)}:pipeline::{audio_md5}",
                audio_b64=audio_b64.decode(),
                session=self.state,
            )
            result = cast(Result | None, result)
            if result is not None:
                turn = ChatSessionState.Turn(
                    **result.model_dump(),
                    index=len(self.state.conversation.messages),
                )
                await self._service.store.chat.record_session_turn(self.state, turn)
                return turn

        async def finish(self) -> None:
            assert self.state.finished, "session not finished yet"
            await self._service.repository.chat.save(self.state.entity())

            # points_net = self.state.points - self.state.expense
            points_net = self.state.points  # TODO: chat mode currently does not have expense
            await self._service.repository.user.increment_points(self.user, points_net)
            await self._service.store.leaderboard.increment(self.user, points_net)

            points_today = await self._service.store.user.increment_points_today(self.user, self.state.points)
            if points_today >= self.user.streak_milestone and not self.user.streak_claimed_today:
                await self._service.repository.user.increment_streak(self.user)

            await self._service.store.chat.discard_session(self.state)

        async def abort(self) -> None:
            await self._service.store.chat.discard_session(self.state)


__all__ = ["ChatService"]
