import base64
from typing import Any, Literal

from pydantic import Base64Bytes, BaseModel, ConfigDict, Field, FieldSerializationInfo, field_serializer

from .._utils import data_urlencode
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

    tasks: list[Task]
    criteria: Criteria
    explanation: str


class Result(BaseModel):
    audio: Base64Bytes = Field(alias="audio_b64", repr=False)

    context: Conversation.UserMessage
    reply: Conversation.AssistantMessage
    pronunciation: Pronunciation
    evaluation: Evaluation

    model_config = ConfigDict(validate_by_name=True)

    @field_serializer("audio", mode="plain")
    @classmethod
    def serialize_audio(cls, value: bytes, info: FieldSerializationInfo) -> str:
        if info.context and "web" in info.context:
            return data_urlencode(value, "audio/wav")
        return base64.b64encode(value).decode()

    def model_post_init(self, context: Any) -> None:
        super().model_post_init(context)
        self.pronunciation.with_transcript(self.context.transcript)


__all__ = ["Scenario", "Conversation", "Evaluation", "Result"]
