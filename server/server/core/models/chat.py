from typing import Any, Literal

from pydantic import BaseModel

from .common import Pronunciation, Transcript


class Scenario(BaseModel):
    scenario: str
    opening: str
    tasks: list[str]


class Conversation(BaseModel):
    class AssistantMessage(BaseModel):
        role: Literal["assistant"] = "assistant"
        content: str

    class UserMessage(BaseModel):
        role: Literal["user"] = "user"
        transcript: Transcript

    messages: list[AssistantMessage | UserMessage]


class Evaluation(BaseModel):
    class Task(BaseModel):
        task: str
        completed: bool

    class Criteria(BaseModel):
        accuracy: float  # grammar
        appropriacy: float  # context
        vocabulary: float  # vocabulary

    tasks: list[Task]
    criteria: Criteria
    explanation: str


class Result(BaseModel):
    context: Conversation.UserMessage
    reply: Conversation.AssistantMessage
    pronunciation: Pronunciation
    evaluation: Evaluation

    def model_post_init(self, context: Any) -> None:
        super().model_post_init(context)
        self.pronunciation.with_transcript(self.context.transcript)


__all__ = ["Scenario", "Conversation", "Evaluation", "Result"]
