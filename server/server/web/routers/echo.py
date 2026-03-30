from contextlib import asynccontextmanager

from fastapi import APIRouter, FastAPI, WebSocket, WebSocketDisconnect

from ..dependencies import Service, User
from ..schemas.echo import EchoInput, EchoOutputType, EchoResponse
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

    async def send_response(data: EchoOutputType) -> None:
        await ws.send_json(EchoResponse.dump(data))

    async def receive_input() -> EchoInput:
        data = await ws.receive_json()
        return EchoInput.model_validate(data)

    await sessions.accept(user, ws)

    session = await service.echo.session(user, generate=True)

    try:
        await session.prepare()
        await send_response(session.state)
        while not session.state.completed:
            while True:
                input = await receive_input()
                match input.type:
                    case EchoInput.Type.NEXT:
                        break
                    case EchoInput.Type.ABORT:
                        return await session.abort()
                    case EchoInput.Type.AUDIO:
                        if input.input is None:
                            continue
                        result = await session.attempt(input.input)
                        await send_response(result)
            await session.proceed()
            await session.refresh()
            await session.prepare()
            await send_response(session.state)
        summary = await session.complete()
        await service.user.add_points_with_streak(user, summary.points)
        await send_response(summary)
        await ws.receive()
    except WebSocketDisconnect:
        ...
    finally:
        await sessions.close(user, ws)


__all__ = ["router"]
