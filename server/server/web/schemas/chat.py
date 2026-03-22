from enum import Enum
from typing import Any

from pydantic import Base64Bytes, BaseModel

from server.core.models.chat import Result
from server.models import ChatSessionState


class ChatInput(BaseModel):
    class Type(str, Enum):
        AUDIO = "audio"
        ABORT = "abort"

    type: Type
    input: Base64Bytes | None = None


class ChatResponse(BaseModel):
    class Type(str, Enum):
        SESSION = "session"
        RESULT = "result"

    class SessionResponse(ChatSessionState): ...

    class ResultResponse(Result): ...

    type: Type
    response: SessionResponse | ResultResponse | None

    @classmethod
    async def dump(cls, data: ChatSessionState | Result | None) -> dict[str, Any]:
        match data:
            case ChatSessionState():
                t = ChatResponse.Type.SESSION
                response = ChatResponse.SessionResponse(**data.model_dump())
            case Result() | None:
                t = ChatResponse.Type.RESULT
                response = ChatResponse.ResultResponse(**data.model_dump()) if data else None
        return cls(type=t, response=response).model_dump(mode="json")


__all__ = ["ChatInput", "ChatResponse"]
