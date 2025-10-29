from fastapi import APIRouter, Depends, HTTPException, Response, UploadFile, status
from ulid import ULID

from server.core import PipelineResult, Transcript
from server.dependencies import Yaplingo, current_user

TRANSCRIPTS: dict[ULID, Transcript] = {}  # TODO: use Redis for storing temporary data

router = APIRouter(dependencies=[Depends(current_user)])


@router.get("/")
async def generate(yaplingo: Yaplingo) -> Transcript:
    transcript = yaplingo.generate_transcript()
    TRANSCRIPTS[transcript.id] = transcript
    return transcript


@router.get("/{tid}.wav")
async def get_pronunciation(tid: ULID, yaplingo: Yaplingo):
    transcript = TRANSCRIPTS.get(tid)
    if transcript is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
    audio = yaplingo.get_pronunciation(transcript.text)
    return Response(content=audio, media_type="audio/vnd.wav")


@router.get("/{tid}")
async def get(tid: ULID) -> Transcript:
    transcript = TRANSCRIPTS.get(tid)
    if transcript is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
    return transcript


@router.post("/{tid}")
async def teach(
    tid: ULID,
    audio: UploadFile,
    yaplingo: Yaplingo,
) -> PipelineResult | None:
    transcript = TRANSCRIPTS.get(tid)
    if transcript is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
    data = await audio.read()
    return yaplingo.analyze(data, transcript)
