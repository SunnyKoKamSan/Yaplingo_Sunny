from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, File, UploadFile
from ulid import ULID

from app.generators.transcript import Transcript
from app.pipeline import Pipeline, Result

TRANSCRIPTS: dict[ULID, Transcript] = {}  # TODO: use Redis for storing temporary data


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.pipeline = Pipeline()
    yield


app = FastAPI(lifespan=lifespan)


def pipeline() -> Pipeline:
    return app.state.pipeline


@app.get("/")
async def get_transcript(pipeline: Pipeline = Depends(pipeline)) -> Transcript:
    transcript = pipeline.generate_transcript()
    TRANSCRIPTS[transcript.id] = transcript
    return transcript


@app.post("/{tid}/teach")
async def post_transcript_teach(
    tid: ULID,
    audio: UploadFile = File(...),
    pipeline: Pipeline = Depends(pipeline),
) -> Result | None:
    transcript = TRANSCRIPTS.get(tid)
    if transcript is None:
        return None
    data = await audio.read()
    return pipeline(data, transcript)
