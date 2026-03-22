from typing import Any, Literal

from pydantic import BaseModel

from .common import Pronunciation, Transcript


class Scenario(BaseModel):
    characters: tuple[str, str]
    scenario: str
    opening: str
    tasks: list[str]


class Conversation(BaseModel):
    class Turn(BaseModel):
        context: "Conversation.UserMessage"
        reply: "Conversation.AssistantMessage"

    class AssistantMessage(BaseModel):
        role: Literal["assistant"] = "assistant"
        content: str

    class UserMessage(BaseModel):
        role: Literal["user"] = "user"
        transcript: Transcript
        pronunciation: Pronunciation

        def model_post_init(self, context: Any) -> None:
            super().model_post_init(context)
            self.pronunciation.with_transcript(self.transcript)

    messages: list[AssistantMessage | UserMessage]


class Evaluation(BaseModel):
    class Task(BaseModel):
        task: str
        completed: bool

    tasks: list[Task]


class Result(Conversation.Turn, Evaluation): ...


__all__ = ["Scenario", "Conversation", "Evaluation", "Result"]
