from enum import Enum

from sqlmodel import Field, SQLModel
from ulid import ULID

from .types import ULIDType


class Language(str, Enum):  # ISO 639-1 (alpha-2) code
    ENGLISH = "en"


class User(SQLModel, table=True):
    id: ULID = Field(default_factory=ULID, primary_key=True, sa_type=ULIDType)
    name: str = Field(unique=True)
    password: str
    language: Language
