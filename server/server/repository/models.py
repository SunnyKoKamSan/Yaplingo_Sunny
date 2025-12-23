from enum import Enum

import argon2
from pydantic import field_validator
from sqlalchemy import CHAR, TypeDecorator
from sqlmodel import Field, SQLModel
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


class Language(str, Enum):  # ISO 639-1 (alpha-2) code
    ENGLISH = "en"


class User(SQLModel, table=True):
    id: ULID = Field(default_factory=ULID, primary_key=True, sa_type=ULIDType)
    name: str = Field(unique=True)
    password: str
    language: Language

    @field_validator("password")
    @classmethod  # last wall of defense to ensure password is hashed before storing into database
    def is_password_hashed(cls, password: str) -> str:
        argon2.extract_parameters(password)  # will raise `InvalidHashError` if not hashed
        return password


__all__ = ["User", "Language"]
