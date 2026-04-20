from contextlib import asynccontextmanager

from fastapi import APIRouter, FastAPI, HTTPException, Request, WebSocket, WebSocketDisconnect, status
from fastapi.responses import StreamingResponse

from server.core.textspeech import DeepgramTextSpeech

from ..dependencies import Service, User
from ..schemas.chat import ChatInput, ChatOutputType, ChatResponse
from ..settings import settings
from ..websocket import SessionManager, Sessions


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.sessions = SessionManager()
    app.state.tts = DeepgramTextSpeech(api_key=settings.deepgram_api_key.get_secret_value())
    yield


router = APIRouter(lifespan=lifespan)


@router.get("/tts")
async def stream_tts(
    request: Request,
    user: User,
    service: Service,
):
    session = await service.chat.session(user, generate=False)
    if session is None or session.state.finished:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No Active Session")

    text = [session.state.scenario.opening, *[turn.reply.content for turn in session.state.turns]][-1]
    tts: DeepgramTextSpeech = request.app.state.tts

    return StreamingResponse(
        tts(text),
        media_type=DeepgramTextSpeech.MIME,
        headers={"Cache-Control": "no-cache"},
    )


@router.websocket("/ws")
async def websocket_session(
    ws: WebSocket,
    user: User,
    sessions: Sessions,
    service: Service,
):

    async def send_response(data: ChatOutputType) -> None:
        await ws.send_json(ChatResponse.dump(data))

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
                        if input.input is None:
                            continue
                        turn = await session.turn(input.input)
                        await send_response(turn)
                        if turn is not None:
                            break
                    case ChatInput.Type.ABORT:
                        return await session.abort()
            await session.refresh()
            await send_response(session.state)
        await session.finish()
        await ws.receive()
    except WebSocketDisconnect:
        ...
    finally:
        await sessions.close(user, ws)


__all__ = ["router"]
