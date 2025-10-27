from fastapi import APIRouter, Response, UploadFile
from ulid import ULID

from server.core import PipelineResult, Transcript
from server.dependencies import Yaplingo

TRANSCRIPTS: dict[ULID, Transcript] = {}  # TODO: use Redis for storing temporary data

router = APIRouter()


@router.get("/")
async def get_new_transcript(yaplingo: Yaplingo) -> Transcript:
    transcript = yaplingo.generate_transcript()
    TRANSCRIPTS[transcript.id] = transcript
    return transcript


@router.get("/{tid}.wav")
async def get_transcript_pronunciation(tid: ULID, yaplingo: Yaplingo):
    transcript = TRANSCRIPTS.get(tid)
    if transcript is None:
        return Response(status_code=404)
    audio = yaplingo.get_pronunciation(transcript.text)
    return Response(content=audio, media_type="audio/vnd.wav")


@router.get("/{tid}")
async def get_transcript(tid: ULID) -> Transcript | None:
    return TRANSCRIPTS.get(tid)


@router.post("/{tid}")
async def post_transcript(
    tid: ULID,
    audio: UploadFile,
    yaplingo: Yaplingo,
) -> PipelineResult | None:
    transcript = TRANSCRIPTS.get(tid)
    if transcript is None:
        return None
    data = await audio.read()
    return yaplingo.analyze(data, transcript)
