from enum import Enum
from typing import Any

from pydantic import Base64Bytes, BaseModel
from ulid import ULID

from server.models import EchoSession, Result, Transcript


class EchoInput(BaseModel):
    class Type(str, Enum):
        AUDIO = "audio"
        NEXT = "next"
        ABORT = "abort"

    type: Type
    input: Base64Bytes | None = None


class EchoResponse(BaseModel):
    class Type(str, Enum):
        SESSION = "session"
        RESULT = "result"
        FBTTS = "fbtts"

    class SessionResponse(BaseModel):
        total: int
        progress: int
        attempted: int
        topic: str
        scenario: str
        transcript: Transcript

    class TranscriptResponse(Transcript): ...

    class ResultResponse(Result): ...

    class FeedbackAudioResponse(BaseModel):
        tid: ULID
        audio: str  # data URL encoded

    type: Type
    response: SessionResponse | TranscriptResponse | FeedbackAudioResponse | ResultResponse | None

    @classmethod
    def dump(cls, data: EchoSession | Result | None | tuple[ULID, str]) -> dict[str, Any]:
        match data:
            case EchoSession():
                t = EchoResponse.Type.SESSION
                response = EchoResponse.SessionResponse(**data.model_dump())
            case Result():
                t = EchoResponse.Type.RESULT
                response = EchoResponse.ResultResponse(**data.model_dump())
            case None:
                t = EchoResponse.Type.RESULT
                response = None
            case tuple([tid, audio]):
                t = EchoResponse.Type.FBTTS
                response = EchoResponse.FeedbackAudioResponse(tid=tid, audio=audio)
        return cls(type=t, response=response).model_dump(mode="json")


__all__ = ["EchoInput", "EchoResponse"]
