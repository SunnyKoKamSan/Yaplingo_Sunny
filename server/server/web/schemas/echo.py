from enum import Enum
from typing import Any

from pydantic import Base64Bytes, BaseModel

from server.models import EchoSessionState


class EchoInput(BaseModel):
    class Type(str, Enum):
        AUDIO = "audio"
        NEXT = "next"
        ABORT = "abort"

    type: Type
    input: Base64Bytes | None = None


EchoOutputType = EchoSessionState | EchoSessionState.Attempt | EchoSessionState.Summary | None


class EchoResponse(BaseModel):
    class Type(str, Enum):
        SESSION = "session"
        ATTEMPT = "attempt"
        SUMMARY = "summary"

    class SessionResponse(EchoSessionState): ...

    class AttemptResponse(EchoSessionState.Attempt): ...

    class SummaryResponse(EchoSessionState.Summary): ...

    type: Type
    response: SessionResponse | AttemptResponse | SummaryResponse | None

    @classmethod
    def dump(cls, data: EchoOutputType) -> dict[str, Any]:
        match data:
            case EchoSessionState():
                t = EchoResponse.Type.SESSION
                response = EchoResponse.SessionResponse(**data.model_dump())
            case EchoSessionState.Attempt() | None:
                t = EchoResponse.Type.ATTEMPT
                if data is None:
                    response = None
                else:
                    response = EchoResponse.AttemptResponse(**data.model_dump())
                    response.pronunciation.with_transcript(data.pronunciation._transcript)
            case EchoSessionState.Summary():
                t = EchoResponse.Type.SUMMARY
                response = EchoResponse.SummaryResponse(**data.model_dump())
        return cls(type=t, response=response).model_dump(mode="json")


__all__ = ["EchoInput", "EchoResponse"]
