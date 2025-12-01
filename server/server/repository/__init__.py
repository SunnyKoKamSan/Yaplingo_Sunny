from argon2 import PasswordHasher
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlmodel import SQLModel, select
from sqlmodel.ext.asyncio.session import AsyncSession
from ulid import ULID

from .models import User
from .settings import settings


class EntityExistsError(Exception):
    def __init__(self):
        super().__init__("Entity already exists.")


class Repository:
    _hasher = PasswordHasher()

    def __init__(self):
        self.engine = create_async_engine(str(settings.url), echo=False, future=True)
        self.session = async_sessionmaker(self.engine, class_=AsyncSession, expire_on_commit=False)

    @classmethod
    async def create(cls):
        self = cls()
        async with self.engine.begin() as conn:
            await conn.run_sync(SQLModel.metadata.create_all)
        return self

    async def dispose(self):
        await self.engine.dispose()

    async def get_user(self, id_name: ULID | str) -> User | None:
        async with self.session() as session:
            if isinstance(id_name, ULID):
                user = await session.get(User, id_name)
            else:
                query = select(User).where(User.name == id_name)
                user = (await session.exec(query)).one_or_none()
        return user

    async def create_user(self, user: User) -> User:
        try:
            async with self.session() as session:
                async with session.begin():
                    session.add(user)
        except IntegrityError:
            raise EntityExistsError()
        return user
