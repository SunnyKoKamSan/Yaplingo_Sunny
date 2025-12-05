from fastapi import APIRouter, Depends, HTTPException, Response, status
from pydantic import Base64Bytes, BaseModel
from ulid import ULID

from server.core import Result, Transcripts

from ..dependencies import Service, current_user

router = APIRouter(dependencies=[Depends(current_user)])


@router.get("/")
async def get_transcripts(service: Service) -> Transcripts:
    return await service.echo.generate()


class Echo(BaseModel):
    audio: Base64Bytes


@router.post("/{tid}")
async def post_transcript(
    tid: ULID,
    echo: Echo,
    response: Response,
    service: Service,
) -> Result | None:
    result = await service.echo.analyze(echo.audio, tid)
    if result is False:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
    if result is None:
        response.status_code = status.HTTP_204_NO_CONTENT
    return result


@router.get("/{tid}/feedback.wav")
async def get_transcript_feedback_audio(tid: ULID, service: Service) -> str:
    audio = await service.echo.synthesize_feedback_audio(tid)
    if audio is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
    return audio
