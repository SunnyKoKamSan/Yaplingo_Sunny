from datetime import datetime, timezone
from zoneinfo import ZoneInfo

import argon2
from pydantic import field_validator
from pydantic_extra_types.language_code import LanguageAlpha2
from pydantic_extra_types.timezone_name import TimeZoneName
from sqlalchemy import ARRAY, CHAR, JSON, TIMESTAMP, String, TypeDecorator
from sqlmodel import Field, Relationship, SQLModel
from ulid import ULID


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
    points: int = Field(default=0, ge=0)
    gems: int = Field(default=0, ge=0)
    streak_freezes: int = Field(default=0, ge=0)

    streak: int = Field(default=0, ge=0)
    streaked_at: datetime = Field(
        default_factory=lambda: datetime.min.replace(tzinfo=timezone.utc),
        sa_type=TIMESTAMP(timezone=True),
    )

    echo_sessions: list["EchoSession"] = Relationship(back_populates="user")
    chat_sessions: list["ChatSession"] = Relationship(back_populates="user")
    achievements: list["UserAchievement"] = Relationship(back_populates="user")

    @field_validator("password")
    @classmethod  # last wall of defense to ensure password is hashed before storing into database
    def is_password_hashed(cls, password: str) -> str:
        argon2.extract_parameters(password)  # will raise `InvalidHashError` if not hashed
        return password

    @property
    def streak_milestone(self) -> int:
        from server import formula

        return formula.get_user_streak_milestone(self)

    @property
    def streak_claimed_today(self) -> bool:
        if self.streak == 0:
            return False
        tz = ZoneInfo(self.timezone)
        today = datetime.now(tz).date()
        return self.streaked_at.astimezone(tz).date() == today


class UserAchievement(SQLModel, table=True):
    __tablename__ = "user_achievement"  # type: ignore

    key: str = Field(primary_key=True)
    claimed_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), sa_type=TIMESTAMP(timezone=True))

    user_id: ULID = Field(foreign_key="user.id", primary_key=True, sa_type=ULIDType)
    user: User = Relationship(back_populates="achievements")


class EchoAttempt(SQLModel, table=True):
    __tablename__ = "echo_attempt"  # type: ignore

    id: ULID = Field(primary_key=True, default_factory=ULID, sa_type=ULIDType)

    index: int
    audio: bytes  # base64
    feedback: str
    pronunciation: dict = Field(sa_type=JSON)

    session_id: ULID = Field(foreign_key="echo_session.id", sa_type=ULIDType)
    session: "EchoSession" = Relationship(back_populates="attempts")


class EchoSession(SQLModel, table=True):
    __tablename__ = "echo_session"  # type: ignore

    id: ULID = Field(primary_key=True, default_factory=ULID, sa_type=ULIDType)

    topic: str
    scenario: str
    points: int
    transcripts: list[str] = Field(sa_type=ARRAY(String))
    completed_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), sa_type=TIMESTAMP(timezone=True))

    user_id: ULID = Field(foreign_key="user.id", sa_type=ULIDType)
    user: User = Relationship(back_populates="echo_sessions")

    attempts: list[EchoAttempt] = Relationship(back_populates="session")


class ChatTurn(SQLModel, table=True):
    __tablename__ = "chat_turn"  # type: ignore

    id: ULID = Field(primary_key=True, default_factory=ULID, sa_type=ULIDType)

    index: int
    audio: bytes  # base64
    context: str
    reply: str
    pronunciation: dict = Field(sa_type=JSON)
    evaluation: dict = Field(sa_type=JSON)

    session_id: ULID = Field(default=None, foreign_key="chat_session.id", sa_type=ULIDType)
    session: "ChatSession" = Relationship(back_populates="turns")


class ChatSession(SQLModel, table=True):
    __tablename__ = "chat_session"  # type: ignore

    id: ULID = Field(primary_key=True, default_factory=ULID, sa_type=ULIDType)

    scenario: str
    opening: str
    points: int
    tasks: list[str] = Field(sa_type=ARRAY(String))
    completed_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), sa_type=TIMESTAMP(timezone=True))

    user_id: ULID = Field(foreign_key="user.id", sa_type=ULIDType)
    user: User = Relationship(back_populates="chat_sessions")

    turns: list[ChatTurn] = Relationship(back_populates="session")


__all__ = ["User", "UserAchievement", "EchoAttempt", "EchoSession", "ChatTurn", "ChatSession"]
