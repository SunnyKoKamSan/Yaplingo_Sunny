from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, File, Response, UploadFile
from ulid import ULID

from app.core import PipelineResult, Transcript, Yaplingo

TRANSCRIPTS: dict[ULID, Transcript] = {}  # TODO: use Redis for storing temporary data


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.yaplingo = Yaplingo()
    yield


app = FastAPI(lifespan=lifespan)


def yaplingo() -> Yaplingo:
    return app.state.yaplingo


@app.get("/")
async def get_new_transcript(yaplingo: Yaplingo = Depends(yaplingo)) -> Transcript:
    transcript = yaplingo.generate_transcript()
    TRANSCRIPTS[transcript.id] = transcript
    return transcript


@app.get("/{tid}")
async def get_transcript(tid: ULID) -> Transcript | None:
    return TRANSCRIPTS.get(tid)


@app.get("/{tid}/pronunciation.wav")
async def get_transcript_pronunciation(tid: ULID, yaplingo: Yaplingo = Depends(yaplingo)):
    transcript = TRANSCRIPTS.get(tid)
    if transcript is None:
        return Response(status_code=404)
    audio = yaplingo.get_pronunciation(transcript.text)
    return Response(content=audio, media_type="audio/vnd.wav")


@app.post("/{tid}/teach")
async def post_transcript_teach(
    tid: ULID,
    audio: UploadFile = File(...),
    yaplingo: Yaplingo = Depends(yaplingo),
) -> PipelineResult | None:
    transcript = TRANSCRIPTS.get(tid)
    if transcript is None:
        return None
    data = await audio.read()
    return yaplingo.analyze(data, transcript)
