import asyncio
from contextlib import asynccontextmanager
from typing import Annotated

from fastapi import APIRouter, Depends, FastAPI, WebSocket, WebSocketDisconnect
from ulid import ULID

from server.models import Result

from ..dependencies import Service, User
from ..schemas.echo import EchoInput, EchoResponse


class SessionManager:
    def __init__(self):
        self.connections: dict[ULID, WebSocket] = {}

    async def accept(self, user: User, ws: WebSocket):
        if user.id in self.connections:
            _ws = self.connections[user.id]
            try:
                await _ws.close()
            except Exception:
                pass
        await ws.accept()
        self.connections[user.id] = ws

    async def close(self, user: User, ws: WebSocket):
        try:
            await ws.close()
        except Exception:
            pass
        if self.connections.get(user.id) is ws:
            del self.connections[user.id]


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.sessions = SessionManager()
    yield


async def sessions(ws: WebSocket) -> SessionManager:
    return ws.app.state.sessions


Sessions = Annotated[SessionManager, Depends(sessions)]


router = APIRouter(lifespan=lifespan)


@router.websocket("/ws")
async def websocket_session(
    ws: WebSocket,
    user: User,
    sessions: Sessions,
    service: Service,
):
    session = await service.echo.load_session(user)
    print(session.attempts, session.progress)  # DEBUG

    async def send_response(data) -> None:
        await ws.send_json(EchoResponse.dump(data))

    async def receive_input() -> EchoInput:
        data = await ws.receive_json()
        return EchoInput.model_validate(data)

    async def send_fbtts_response(result: Result) -> None:
        assert session is not None, "session cannot be none when sending fbtts response"
        tid = result.pronunciation.transcript.id
        fbtts = await service.echo.retrieve_fbtts(session, result)
        await send_response((tid, fbtts))

    try:
        await sessions.accept(user, ws)
        while session is not None and session.progress < len(session.items):
            if not session.attempted:
                await send_response(session)
                while True:
                    input = await receive_input()
                    match input.type:
                        case EchoInput.Type.NEXT:
                            break
                        case EchoInput.Type.ABORT:
                            return await service.echo.abort_session(session)
                        case EchoInput.Type.AUDIO:
                            assert input.input is not None, "audio input cannot be none"
                            result = await service.echo.submit_attempt(session, input.input)
                            await send_response(result if result is not None else None)
                            if result is not None:
                                asyncio.create_task(send_fbtts_response(result))
            await service.echo.proceed_session(session)
            session = await service.echo.load_session(user, generate=False)  # refresh session
    except WebSocketDisconnect:
        pass  # do not reraise on disconnect
    finally:
        await sessions.close(user, ws)


__all__ = ["router"]
