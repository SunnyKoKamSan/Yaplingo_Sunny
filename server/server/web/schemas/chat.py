from enum import Enum
from typing import Any

from pydantic import Base64Bytes, BaseModel

from server.models import ChatSessionState


class ChatInput(BaseModel):
    class Type(str, Enum):
        AUDIO = "audio"
        ABORT = "abort"

    type: Type
    input: Base64Bytes | None = None


ChatOutputType = ChatSessionState.Turn | ChatSessionState | None


class ChatResponse(BaseModel):
    class Type(str, Enum):
        SESSION = "session"
        TURN = "turn"

    class SessionResponse(ChatSessionState): ...

    class TurnResponse(ChatSessionState.Turn): ...

    type: Type
    response: SessionResponse | TurnResponse | None

    @classmethod
    def dump(cls, data: ChatOutputType) -> dict[str, Any]:
        match data:
            case ChatSessionState():
                t = ChatResponse.Type.SESSION
                response = ChatResponse.SessionResponse(**data.model_dump())
            case ChatSessionState.Turn() | None:
                t = ChatResponse.Type.TURN
                response = ChatResponse.TurnResponse(**data.model_dump()) if data else None
        return cls(type=t, response=response).model_dump(mode="json", context={"web"})


__all__ = ["ChatInput", "ChatResponse"]
