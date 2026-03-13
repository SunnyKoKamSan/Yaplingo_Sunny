from datetime import datetime, timezone

from typing import TYPE_CHECKING, List

import argon2
from pydantic import field_validator
from pydantic_extra_types.language_code import LanguageAlpha2
from pydantic_extra_types.timezone_name import TimeZoneName
from sqlalchemy import CHAR, JSON, TIMESTAMP, TypeDecorator
from sqlmodel import Field, Relationship, SQLModel
from typing_extensions import Self
from ulid import ULID

from server.store.echo import EchoSessionState

if TYPE_CHECKING:
    from .gamification import LeaderboardEntry


class ULIDType(TypeDecorator):
    impl = CHAR
    cache_ok = True

    def __init__(self, length=26, *args, **kwargs):
        super().__init__(length=length, *args, **kwargs)

    def process_bind_param(self, value, dialect):
        if value is None:
            return None
        if isinstance(value, ULID):
            return str(value)
        return str(ULID.from_str(value))  # try parsing from string

    def process_result_value(self, value, dialect):
        if value is None:
            return None
        return ULID.from_str(value)


class User(SQLModel, table=True):
    id: ULID = Field(primary_key=True, default_factory=ULID, sa_type=ULIDType)
    name: str = Field(unique=True)
    password: str
    language: LanguageAlpha2
    timezone: TimeZoneName

    leaderboard_entries: List["LeaderboardEntry"] = Relationship(back_populates="user")

    @field_validator("password")
    @classmethod  # last wall of defense to ensure password is hashed before storing into database
    def is_password_hashed(cls, password: str) -> str:
        argon2.extract_parameters(password)  # will raise `InvalidHashError` if not hashed
        return password


class EchoAttempt(SQLModel, table=True):
    id: ULID = Field(primary_key=True, default_factory=ULID, sa_type=ULIDType)
    transcript_id: ULID = Field(default=None, foreign_key="echotranscript.id", sa_type=ULIDType)

    audio: bytes  # base64
    result: dict = Field(sa_type=JSON)

    transcript: "EchoTranscript" = Relationship(back_populates="attempts")


class EchoTranscript(SQLModel, table=True):
    id: ULID = Field(primary_key=True, default_factory=ULID, sa_type=ULIDType)
    session_id: ULID = Field(default=None, foreign_key="echosession.id", sa_type=ULIDType)

    index: int
    text: str

    session: "EchoSession" = Relationship(back_populates="transcripts")
    attempts: list[EchoAttempt] = Relationship(back_populates="transcript")


class EchoSession(SQLModel, table=True):
    id: ULID = Field(primary_key=True, default_factory=ULID, sa_type=ULIDType)
    user_id: ULID = Field(foreign_key="user.id", sa_type=ULIDType)

    topic: str
    scenario: str
    completed_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), sa_type=TIMESTAMP(timezone=True))

    transcripts: list[EchoTranscript] = Relationship(back_populates="session")

    @classmethod
    def from_state(cls, state: EchoSessionState) -> Self:
        return cls(
            user_id=state._uid,
            topic=state.topic,
            scenario=state.scenario,
            transcripts=[
                EchoTranscript(
                    index=index,
                    text=item.text,
                    attempts=[
                        EchoAttempt(
                            audio=attempt.audio_b64,
                            result=attempt.model_dump(mode="json", exclude={"audio_b64"}),
                        )
                        for attempt in state.attempts[index]
                    ],
                )
                for index, item in enumerate(state.transcripts)
            ],
        )


__all__ = ["User", "EchoTranscript", "EchoAttempt", "EchoSession"]
