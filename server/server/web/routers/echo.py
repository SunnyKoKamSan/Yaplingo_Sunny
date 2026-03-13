from contextlib import asynccontextmanager
from typing import Annotated, Any

from fastapi import APIRouter, Depends, FastAPI, WebSocket, WebSocketDisconnect
from ulid import ULID

from ..dependencies import Service, User
from ..schemas.echo import EchoInput, EchoResponse


class SessionManager:
    def __init__(self):
        self.connections: dict[ULID, WebSocket] = {}

    async def accept(self, user: User, ws: WebSocket):
        if user.id in self.connections:
            _ws = self.connections[user.id]
            # Detach old connection so its finally block won't remove our new entry
            self.connections[user.id] = ws
            try:
                await _ws.close()
            except Exception:
                pass
        else:
            self.connections[user.id] = ws
        await ws.accept()

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
    # Accept WebSocket FIRST so the client doesn't time out during session generation
    await sessions.accept(user, ws)

    async def send_response(data: Any, t: EchoResponse.Type | None = None) -> None:
        data = await EchoResponse.dump(data, t)
        await ws.send_json(data)

    async def receive_input() -> EchoInput:
        data = await ws.receive_json()
        return EchoInput.model_validate(data)

    try:
        session = await service.echo.session(user, generate=True)
        while not session.completed:
            if not session.state.attempted:
                print(
                    "current session state:",
                    session.state.progress,
                    [len(attempts) for attempts in session.state.attempts],
                )
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
                            await send_response(result if result is not None else None)
            if await session.proceed():
                await session.refresh()
            else:
                await send_response(session.state, EchoResponse.Type.SUMMARY)
                # Keep the socket alive after summary; the client decides when to close.
                while True:
                    await ws.receive()
    except WebSocketDisconnect:
        pass  # do not reraise on disconnect
    except Exception as e:
        print(f"ERROR in echo session: {e}")
    finally:
        await sessions.close(user, ws)


__all__ = ["router"]
