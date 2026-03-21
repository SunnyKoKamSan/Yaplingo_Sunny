from typing import Annotated

from fastapi import Depends, WebSocket
from ulid import ULID

from .dependencies import User


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


async def sessions(ws: WebSocket) -> SessionManager:
    return ws.app.state.sessions


Sessions = Annotated[SessionManager, Depends(sessions)]
