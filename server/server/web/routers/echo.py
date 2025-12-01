from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Response, status
from pydantic import Base64Bytes, BaseModel
from ulid import ULID

from server.core import Result, Transcripts

from ..dependencies import Service, current_user

router = APIRouter(dependencies=[Depends(current_user)])


@router.get("/transcripts")
async def get_transcripts(service: Service) -> Transcripts:
    return await service.echo.generate()


class Echo(BaseModel):
    audio: Base64Bytes


@router.post("/{tid}", status_code=status.HTTP_201_CREATED)
async def post_transcript(
    tid: ULID,
    echo: Echo,
    service: Service,
    background: BackgroundTasks,
) -> None:
    # TODO: handle non-existing transcript
    background.add_task(service.echo.analyze, echo.audio, tid)


@router.get("/{tid}/result")
async def get_transcript_result(tid: ULID, response: Response, service: Service) -> Result | None:
    result = await service.echo.result(tid)
    if result is False:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
    if result is None or result.pending:
        raise HTTPException(status_code=status.HTTP_425_TOO_EARLY)
    if isinstance(result.result, Exception):
        # FIXME: improve error handling
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR)
    if result.result is None:
        response.status_code = status.HTTP_204_NO_CONTENT
    return result.result
