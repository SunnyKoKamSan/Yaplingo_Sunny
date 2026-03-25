from pydantic import BaseModel

from .common import Pronunciation, Transcript


class Scenario(BaseModel):
    topic: str
    scenario: str
    transcripts: list[Transcript]


class Result(BaseModel):
    feedback: str
    pronunciation: Pronunciation


__all__ = [
    "Scenario",
    "Result",
]
