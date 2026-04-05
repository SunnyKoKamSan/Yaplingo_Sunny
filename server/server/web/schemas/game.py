from pydantic import BaseModel
from ulid import ULID


class LeaderboardResponse(BaseModel):
    class Entry(BaseModel):
        uid: ULID
        name: str
        rank: int
        score: int

    entries: list[Entry]
    me: Entry


__all__ = ["LeaderboardResponse"]
