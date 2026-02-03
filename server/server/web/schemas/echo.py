from enum import Enum
from typing import Annotated, Any

from pydantic import Base64Bytes, BaseModel, Field

from server.models import EchoSessionState, Result, Transcript


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

    class SessionResponse(BaseModel):
        class Transcript(Transcript):
            audio: Annotated[str, Field(repr=False)]

        total: int
        progress: int
        attempts: list[int]
        topic: str
        scenario: str
        transcript: Transcript

    class ResultResponse(Result): ...

    type: Type
    response: SessionResponse | ResultResponse | None

    @classmethod
    async def dump(cls, data: EchoSessionState | Result | None) -> dict[str, Any]:
        match data:
            case EchoSessionState():
                t = EchoResponse.Type.SESSION
                response = EchoResponse.SessionResponse(
                    # exclude attempts to avoid evaluating computed fields
                    # provide transcript separately to include audio
                    **data.model_dump(exclude={"attempts", "transcript"}),
                    attempts=[len(attempts) for attempts in data.attempts],
                    transcript=EchoResponse.SessionResponse.Transcript(
                        **data.transcript.model_dump(),
                        audio=await data.transcript.get_audio(),
                    ),
                )
            case Result():
                t = EchoResponse.Type.RESULT
                response = EchoResponse.ResultResponse(**data.model_dump())
                response.pronunciation.with_transcript(data.pronunciation._transcript)
            case None:
                t = EchoResponse.Type.RESULT
                response = None
        return cls(type=t, response=response).model_dump(mode="json")


__all__ = ["EchoInput", "EchoResponse"]
