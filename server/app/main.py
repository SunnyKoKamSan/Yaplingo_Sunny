from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, File, UploadFile

from app.pipeline import Pipeline, Result

TRANSCRIPTS = {
    1: "the quick brown fox jumps over the lazy dog",
    2: "the cat sat on the mat",
}


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.pipeline = Pipeline()
    yield


app = FastAPI(lifespan=lifespan)


def get_pipeline() -> Pipeline:
    return app.state.pipeline


@app.post("/teach/{tid}")
async def teach(tid: int, audio: UploadFile = File(...), pipeline: Pipeline = Depends(get_pipeline)) -> Result | None:
    transcript = TRANSCRIPTS[tid]
    data = await audio.read()
    return pipeline(data, transcript)
