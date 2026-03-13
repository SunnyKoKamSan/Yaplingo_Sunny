from contextlib import asynccontextmanager

from fastapi import FastAPI, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import PlainTextResponse
from starlette.exceptions import HTTPException

from server.logging_config import configure_runtime_logging
from server.service import Service
from server.web.routers import auth, chat, echo, gamification


@asynccontextmanager
async def lifespan(app: FastAPI):
    configure_runtime_logging()
    app.state.service = await Service.create()
    yield
    await app.state.service.dispose()


app = FastAPI(lifespan=lifespan)


@app.exception_handler(HTTPException)
def http_exception_handler(_, exc: HTTPException):
    return PlainTextResponse(str(exc.detail), status_code=exc.status_code)


@app.exception_handler(RequestValidationError)
def request_validation_error_handler(_, exc: RequestValidationError):
    import logging
    logging.getLogger("uvicorn.error").warning(f"Validation error: {exc.errors()}")
    return PlainTextResponse("Invalid Request", status_code=status.HTTP_400_BAD_REQUEST)


app.include_router(auth.router, prefix="/auth")
app.include_router(chat.router, prefix="/chat")
app.include_router(echo.router, prefix="/echo")
app.include_router(gamification.router, prefix="/gamification")
