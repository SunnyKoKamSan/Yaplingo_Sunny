from contextlib import asynccontextmanager

from fastapi import FastAPI

from server.core import Yaplingo
from server.routers import transcript


@asynccontextmanager
async def lifespan(app: FastAPI):
    # initialize the Yaplingo singleton instance
    app.state.yaplingo = Yaplingo()
    yield


app = FastAPI(lifespan=lifespan)

app.include_router(transcript.router, prefix="/transcript")
