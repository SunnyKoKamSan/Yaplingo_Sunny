import asyncio
from enum import Enum
from typing import Annotated, Any

from pydantic import Base64Bytes, BaseModel, Field

from server.core.models.echo import Result, Transcript
from server.models import EchoSessionState


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
        SUMMARY = "summary"

    class SessionResponse(BaseModel):
        topic: str
        scenario: str
        total: int
        progress: int
        attempted: int
        transcript: Transcript
        attempts: list[int]

    class ResultResponse(Result): ...

    class SummaryResponse(BaseModel):
        class Attempt(Result):  # same as `EchoSessionState.Attempt`
            audio_b64: Annotated[
                Base64Bytes,
                Field(
                    serialization_alias="audio",
                    repr=False,
                ),
            ]

        total: int
        topic: str
        scenario: str
        transcripts: list[Transcript]
        attempts: list[list[Attempt]]

        def model_post_init(self, context: Any) -> None:
            super().model_post_init(context)
            for index, attempts in enumerate(self.attempts):
                for attempt in attempts:
                    attempt.pronunciation.with_transcript(self.transcripts[index])

    type: Type
    response: SessionResponse | ResultResponse | SummaryResponse | None

    @classmethod
    async def dump(cls, data: EchoSessionState | Result | None, t: Type | None = None) -> dict[str, Any]:
        match data:
            case EchoSessionState():
                assert t is not None, "response type must be provided for session state data"
                if t == EchoResponse.Type.SESSION:
                    await data.transcript.get_audio()
                    response = EchoResponse.SessionResponse(
                        **data.model_dump(
                            exclude={
                                "attempts",
                                "transcripts",
                            }
                        ),
                        attempts=[len(attempts) for attempts in data.attempts],
                    )
                else:  # t == EchoResponse.Type.SUMMARY
                    await asyncio.gather(*[transcript.get_audio() for transcript in data.transcripts])
                    response = EchoResponse.SummaryResponse(
                        **data.model_dump(exclude={"transcript", "progress", "attempted"})
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
