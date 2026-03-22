from datetime import timedelta
from functools import cached_property
from typing import Annotated, Awaitable, cast

from pydantic import BaseModel, ConfigDict, PrivateAttr, computed_field
from redis.asyncio import Redis
from typing_extensions import Self
from ulid import ULID

from server.core.models.chat import Conversation, Evaluation, Result, Scenario

SESSION_TTL = timedelta(hours=1)


class ChatSessionState(BaseModel):
    # class Result(Result):
    #     audio_b64: Annotated[
    #         Base64Bytes,
    #         Field(
    #             serialization_alias="audio",
    #             repr=False,
    #         ),
    #     ]

    #     model_config = ConfigDict(frozen=True)

    characters: tuple[str, str]
    scenario: str
    tasks: list[Evaluation.Task]
    messages: list[Conversation.AssistantMessage | Conversation.UserMessage]

    _uid: Annotated[ULID, PrivateAttr()]

    limit: int = 5  # TODO: make this configurable per scenario

    model_config = ConfigDict(frozen=True)

    def __repr__(self) -> str:
        return f"chat:{str(self._uid)}"

    @classmethod
    def new(cls, uid: ULID, scenario: Scenario) -> Self:
        return cls(
            **scenario.model_dump(exclude={"opening", "tasks"}),
            tasks=[
                Evaluation.Task(
                    task=task,
                    completed=False,
                )
                for task in scenario.tasks
            ],
            messages=[
                Conversation.AssistantMessage(
                    content=scenario.opening,
                )
            ],
        ).with_uid(uid)

    def with_uid(self, uid: ULID) -> Self:
        self._uid = uid
        return self

    @cached_property
    def _scenario(self) -> Scenario:
        assert isinstance(self.messages[0], Conversation.AssistantMessage), (
            "the first message must be the opening line from the assistant"
        )
        return Scenario(
            characters=self.characters,
            scenario=self.scenario,
            opening=self.messages[0].content,
            tasks=[task.task for task in self.tasks],
        )

    @cached_property
    def _conversation(self) -> Conversation:
        return Conversation(messages=self.messages)

    @computed_field
    @cached_property
    def quota(self) -> int:
        user_turns = filter(lambda m: m.role == "user", self.messages)
        return self.limit - len(list(user_turns))

    @computed_field
    @cached_property
    def finished(self) -> bool:
        return all(t.completed for t in self.tasks) or self.quota <= 0


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

    async def record_session_result(self, session: ChatSessionState, result: Result) -> None:
        pipe = self._client.pipeline()
        pipe.json().arrappend(
            repr(session),
            "$.messages",
            Conversation.UserMessage(
                transcript=result.context.transcript,
                pronunciation=result.context.pronunciation,
            ).model_dump(mode="json", exclude_computed_fields=True),
            Conversation.AssistantMessage(
                content=result.reply.content,
            ).model_dump(mode="json", exclude_computed_fields=True),
        )
        completions = {t.task for t in session.tasks if t.completed}
        pipe.json().set(
            repr(session),
            "$.tasks",
            [
                Evaluation.Task(
                    task=t.task,
                    completed=t.completed or t.task in completions,
                ).model_dump(mode="json", exclude_computed_fields=True)
                for t in result.tasks
            ],
        )
        await pipe.execute()

    async def discard_session(self, session: ChatSessionState) -> None:
        await self._client.delete(repr(session))


__all__ = ["ChatStore", "ChatSessionState"]
