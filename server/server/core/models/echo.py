import base64

from pydantic import Base64Bytes, BaseModel, ConfigDict, Field, FieldSerializationInfo, field_serializer

from .._utils import data_urlencode
from .common import Pronunciation, Transcript


class Scenario(BaseModel):
    topic: str
    scenario: str
    transcripts: list[Transcript]


class Result(BaseModel):
    audio: Base64Bytes = Field(alias="audio_b64", repr=False)

    feedback: str
    pronunciation: Pronunciation

    model_config = ConfigDict(validate_by_name=True)

    @field_serializer("audio", mode="plain")
    @classmethod
    def serialize_audio(cls, value: bytes, info: FieldSerializationInfo) -> str:
        if info.context and "web" in info.context:
            return data_urlencode(value, "audio/wav")
        return base64.b64encode(value).decode()


__all__ = [
    "Scenario",
    "Result",
]
