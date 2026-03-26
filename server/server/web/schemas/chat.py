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


ChatOutputType = ChatSessionState.Turn | ChatSessionState | ChatSessionState.Summary | None


class ChatResponse(BaseModel):
    class Type(str, Enum):
        SESSION = "session"
        TURN = "turn"
        SUMMARY = "summary"

    class SessionResponse(ChatSessionState): ...

    class TurnResponse(ChatSessionState.Turn): ...

    class SummaryResponse(ChatSessionState.Summary): ...

    type: Type
    response: SessionResponse | TurnResponse | SummaryResponse | None

    @classmethod
    def dump(cls, data: ChatOutputType) -> dict[str, Any]:
        match data:
            case ChatSessionState():
                t = ChatResponse.Type.SESSION
                response = ChatResponse.SessionResponse(**data.model_dump())
            case ChatSessionState.Turn() | None:
                t = ChatResponse.Type.TURN
                response = ChatResponse.TurnResponse(**data.model_dump()) if data else None
            case ChatSessionState.Summary():
                t = ChatResponse.Type.SUMMARY
                response = ChatResponse.SummaryResponse(**data.model_dump())
        return cls(type=t, response=response).model_dump(mode="json")


__all__ = ["ChatInput", "ChatResponse"]
