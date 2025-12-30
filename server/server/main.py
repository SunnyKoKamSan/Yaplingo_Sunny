from contextlib import asynccontextmanager

from fastapi import FastAPI, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import PlainTextResponse
from starlette.exceptions import HTTPException

from server.core import Yaplingo
from server.repository import Repository
from server.routers import auth, echo
from server.store import Store


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.yaplingo = Yaplingo()
    app.state.repository = await Repository.create()
    app.state.store = await Store.create()
    yield
    await app.state.repository.dispose()
    await app.state.store.dispose()


app = FastAPI(lifespan=lifespan)


@app.exception_handler(HTTPException)
def http_exception_handler(_, exc: HTTPException):
    return PlainTextResponse(str(exc.detail), status_code=exc.status_code)


@app.exception_handler(RequestValidationError)
def request_validation_error_handler(_, exc: RequestValidationError):
    return PlainTextResponse("Invalid Request", status_code=status.HTTP_400_BAD_REQUEST)


app.include_router(auth.router, prefix="/auth")
app.include_router(echo.router, prefix="/echo")
