from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlmodel import SQLModel, select
from sqlmodel.ext.asyncio.session import AsyncSession
from ulid import ULID

from ..schemas import UserCreation, UserCredentials
from .models import User
from .settings import settings


class EntityExistsError(Exception):
    def __init__(self):
        super().__init__("Entity already exists.")


class Repository:
    _hasher = PasswordHasher()

    def __init__(self):
        self._engine = create_async_engine(str(settings.url), echo=False, future=True)
        self.session = async_sessionmaker(self._engine, class_=AsyncSession, expire_on_commit=False)

    @classmethod
    async def create(cls):
        self = cls()
        async with self._engine.begin() as conn:
            await conn.run_sync(SQLModel.metadata.create_all)
        return self

    async def dispose(self):
        await self._engine.dispose()

    async def get_user(self, id: ULID) -> User | None:
        async with self.session() as session:
            user = await session.get(User, id)
        return user

    async def check_user(self, credentials: UserCredentials) -> User | None:
        async with self.session() as session:
            query = select(User).where(User.name == credentials.name)
            user = (await session.exec(query)).one_or_none()
        if user is None:
            return None
        try:
            self._hasher.verify(user.password, credentials.password)
        except VerifyMismatchError:
            return None
        return user

    async def create_user(self, data: UserCreation) -> User:
        # hash password before storing into database
        data.password = self._hasher.hash(data.password)
        # auto map UserCreate (DTO) to User (DO) model
        user = User.model_validate(data)
        # perform database operation
        try:
            async with self.session() as session:
                async with session.begin():
                    session.add(user)
        except IntegrityError:
            raise EntityExistsError()
        return user
