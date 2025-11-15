from fastapi import APIRouter, Depends, HTTPException, status
from ulid import ULID

from server.core import Result, Transcript
from server.dependencies import Yaplingo, current_user
from server.schemas import TeachAudio

TRANSCRIPTS: dict[ULID, Transcript] = {}  # TODO: use Redis for storing ephemeral data

router = APIRouter(dependencies=[Depends(current_user)])


@router.get("/")
async def generate(yaplingo: Yaplingo) -> Transcript:
    transcript = yaplingo.generate_transcript()
    TRANSCRIPTS[transcript.id] = transcript
    return transcript


@router.get("/{tid}")
async def get(tid: ULID) -> Transcript:
    transcript = TRANSCRIPTS.get(tid)
    if transcript is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
    return transcript


@router.post("/{tid}")
async def teach(
    tid: ULID,
    audio: TeachAudio,
    yaplingo: Yaplingo,
) -> Result | None:
    transcript = TRANSCRIPTS.get(tid)
    if transcript is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
    return yaplingo.analyze_audio(audio.audio, transcript)
