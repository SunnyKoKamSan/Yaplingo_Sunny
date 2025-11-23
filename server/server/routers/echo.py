from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from pydantic import Base64Bytes, BaseModel
from ulid import ULID

from server.core import Result, Transcript, Transcripts
from server.dependencies import Yaplingo, current_user

# TODO: use Redis for storing ephemeral data
TRANSCRIPTS: dict[ULID, Transcript] = {}
RESULTS: dict[ULID, Result | Exception | None] = {}

router = APIRouter(dependencies=[Depends(current_user)])


@router.get("/transcripts")
async def get_transcripts(yaplingo: Yaplingo) -> Transcripts:
    transcripts = yaplingo.generate_transcripts()
    for item in transcripts.items:
        TRANSCRIPTS[item.id] = item
    return transcripts


class Echo(BaseModel):
    audio: Base64Bytes


@router.post("/{tid}", status_code=status.HTTP_201_CREATED)
async def post_transcript(
    tid: ULID,
    echo: Echo,
    yaplingo: Yaplingo,
    background: BackgroundTasks,
) -> None:
    transcript = TRANSCRIPTS.get(tid)
    if transcript is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)

    def process_audio():
        try:
            RESULTS[tid] = yaplingo.analyze_audio(echo.audio, transcript)
        except Exception as e:
            RESULTS[tid] = e

    background.add_task(process_audio)


@router.get("/{tid}/result")
async def get_transcript_result(tid: ULID) -> Result | None:
    if tid not in TRANSCRIPTS:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
    if tid not in RESULTS:
        raise HTTPException(status_code=status.HTTP_425_TOO_EARLY)
    result = RESULTS.get(tid)
    if isinstance(result, Exception):
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR)
    return result
