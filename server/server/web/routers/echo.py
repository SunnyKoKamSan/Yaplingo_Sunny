from contextlib import asynccontextmanager
from typing import Any

from fastapi import APIRouter, FastAPI, WebSocket, WebSocketDisconnect

from ..dependencies import Service, User
from ..schemas.echo import EchoInput, EchoResponse
from ..websocket import SessionManager, Sessions


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.sessions = SessionManager()
    yield


router = APIRouter(lifespan=lifespan)


@router.websocket("/ws")
async def websocket_session(
    ws: WebSocket,
    user: User,
    sessions: Sessions,
    service: Service,
):
    session = await service.echo.session(user, generate=True)

    async def send_response(data: Any, t: EchoResponse.Type | None = None) -> None:
        data = await EchoResponse.dump(data, t)
        await ws.send_json(data)

    async def receive_input() -> EchoInput:
        data = await ws.receive_json()
        return EchoInput.model_validate(data)

    try:
        await sessions.accept(user, ws)
        while not session.completed:
            if not session.state.attempted:
                await send_response(session.state, EchoResponse.Type.SESSION)
                while True:
                    input = await receive_input()
                    match input.type:
                        case EchoInput.Type.NEXT:
                            break
                        case EchoInput.Type.ABORT:
                            return await session.abort()
                        case EchoInput.Type.AUDIO:
                            assert input.input is not None, "audio input cannot be none"
                            result = await session.attempt(input.input)
                            await send_response(result)
            if await session.proceed():
                await session.refresh()
            else:
                await send_response(session.state, EchoResponse.Type.SUMMARY)
                await ws.receive()  # wait for client to acknowledge completion before closing
    except WebSocketDisconnect:
        pass  # do not reraise on disconnect
    finally:
        await sessions.close(user, ws)


__all__ = ["router"]
