import itertools
from datetime import timedelta
from functools import cached_property
from typing import Any, Awaitable, cast

from pydantic import Base64Bytes, BaseModel, ConfigDict, Field, PrivateAttr, computed_field
from redis.asyncio import Redis
from typing_extensions import Self
from ulid import ULID

from server.core.models.chat import Conversation, Evaluation, Result, Scenario

SESSION_TTL = timedelta(hours=1)


class ChatSessionState(BaseModel):
    class Turn(Result):
        index: int  # index of the turn in the conversation
        audio_b64: Base64Bytes = Field(serialization_alias="audio", repr=False)

        model_config = ConfigDict(frozen=True)

        def model_post_init(self, context: Any) -> None:
            super().model_post_init(context)
            self.pronunciation.with_transcript(self.context.transcript)

    class Summary(BaseModel):
        points: int

    _uid: ULID = PrivateAttr()

    scenario: Scenario
    turns: list[Turn] = []

    limit: int = 5  # TODO: make this configurable per scenario

    model_config = ConfigDict(frozen=True)

    def __repr__(self) -> str:
        return f"chat:{str(self._uid)}"

    def with_uid(self, uid: ULID) -> Self:
        self._uid = uid
        return self

    @computed_field
    @cached_property
    def tasks(self) -> list[Evaluation.Task]:
        completions = {t.task for turn in self.turns for t in turn.evaluation.tasks if t.completed}
        return [Evaluation.Task(task=task, completed=task in completions) for task in self.scenario.tasks]

    @computed_field
    @cached_property
    def conversation(self) -> Conversation:
        return Conversation(
            messages=[
                Conversation.AssistantMessage(content=self.scenario.opening),
                *itertools.chain.from_iterable([t.context, t.reply] for t in self.turns),
            ]
        )

    @computed_field
    @cached_property
    def quota(self) -> int:
        return self.limit - len(self.turns)

    @computed_field
    @cached_property
    def finished(self) -> bool:
        return all(t.completed for t in self.tasks) or self.quota <= 0

    @cached_property
    def summary(self) -> Summary:
        assert self.finished, "session not finished yet"
        assert len(self.turns) > 0, "no turns taken in the session"  # should never happen
        points = sum(1 for t in self.tasks if t.completed) * 33
        points += sum(round(t.pronunciation.score * 100) for t in self.turns) // len(self.turns)
        return ChatSessionState.Summary(points=points)


class ChatStore:
    def __init__(self, client: Redis):
        self._client = client

    async def stash_session(self, session: ChatSessionState) -> ChatSessionState:
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

    async def get_session(self, uid: ULID) -> ChatSessionState | None:
        op = self._client.json().get(f"chat:{str(uid)}")
        data = await cast(Awaitable[dict | None], op)
        if data is not None:
            return ChatSessionState(**data).with_uid(uid)

    async def record_session_turn(self, session: ChatSessionState, turn: ChatSessionState.Turn) -> None:
        op = self._client.json().arrappend(
            repr(session),
            "$.turns",
            turn.model_dump(mode="json", exclude_computed_fields=True),
        )
        await cast(Awaitable[list[int | None]], op)

    async def discard_session(self, session: ChatSessionState) -> None:
        await self._client.delete(repr(session))


__all__ = ["ChatStore", "ChatSessionState"]
