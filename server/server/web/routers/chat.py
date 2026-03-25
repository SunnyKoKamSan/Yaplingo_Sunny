from contextlib import asynccontextmanager

from fastapi import APIRouter, FastAPI, WebSocket, WebSocketDisconnect

from ..dependencies import Service, User
from ..schemas.chat import ChatInput, ChatOutputType, ChatResponse
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

    async def send_response(data: ChatOutputType) -> None:
        await ws.send_json(await ChatResponse.dump(data))

    async def receive_input() -> ChatInput:
        data = await ws.receive_json()
        return ChatInput.model_validate(data)

    await sessions.accept(user, ws)

    session = await service.chat.session(user, generate=True)

    try:
        await send_response(session.state)
        while not session.state.finished:
            while True:
                input = await receive_input()
                match input.type:
                    case ChatInput.Type.AUDIO:
                        assert input.input is not None, "audio input cannot be none"
                        turn = await session.turn(input.input)
                        await send_response(turn)
                        if turn is not None:
                            break
                    case ChatInput.Type.ABORT:
                        return await session.abort()
            await session.refresh()
            await send_response(session.state)
        summary = await session.finish()
        await send_response(summary)
        await ws.receive()
    except WebSocketDisconnect:
        pass
    finally:
        await sessions.close(user, ws)


__all__ = ["router"]
