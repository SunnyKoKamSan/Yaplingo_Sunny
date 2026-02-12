import asyncio
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
        SUMMARY = "summary"

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

    class SummaryResponse(SessionResponse):
        transcript: Annotated[None, Field(exclude=True)] = None
        transcripts: list["EchoResponse.SessionResponse.Transcript"]
        attempts: list[list[EchoSessionState.Attempt]]

    type: Type
    response: SessionResponse | ResultResponse | SummaryResponse | None

    @classmethod
    async def dump(cls, data: EchoSessionState | Result | None, t: Type | None = None) -> dict[str, Any]:
        match data:
            case EchoSessionState():
                assert t is not None, "response type must be provided for session state data"
                if t == EchoResponse.Type.SESSION:
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
                else:  # t == EchoResponse.Type.SUMMARY
                    gather_audio = asyncio.gather(
                        # probably already cached previously
                        *[item.get_audio() for item in data.items]
                    )
                    response = EchoResponse.SummaryResponse(
                        **data.model_dump(exclude={"transcript"}),
                        transcripts=[
                            EchoResponse.SessionResponse.Transcript(
                                **item.model_dump(),
                                audio=audio,
                            )
                            for item, audio in zip(data.items, await gather_audio)
                        ],
                    )
                    for index, attempts in enumerate(response.attempts):
                        for attempt in attempts:
                            attempt.result.pronunciation.with_transcript(response.transcripts[index])
            case Result():
                t = EchoResponse.Type.RESULT
                response = EchoResponse.ResultResponse(**data.model_dump())
                response.pronunciation.with_transcript(data.pronunciation._transcript)
            case None:
                t = EchoResponse.Type.RESULT
                response = None
        return cls(type=t, response=response).model_dump(mode="json")


__all__ = ["EchoInput", "EchoResponse"]
