from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError
from sqlalchemy import create_engine
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, SQLModel, select
from ulid import ULID

from server.schemas import UserCreation, UserCredentials

from .models import User
from .settings import settings


class EntityExistsError(Exception):
    def __init__(self):
        super().__init__("Entity already exists.")


class Repository:
    def __init__(self):
        self._hasher = PasswordHasher()
        self._engine = create_engine(settings.url)
        SQLModel.metadata.create_all(self._engine)

    def dispose(self):
        self._engine.dispose()

    def get_user(self, id: ULID) -> User | None:
        with Session(self._engine) as session:
            user = session.get(User, str(id))
        return user

    def check_user(self, credentials: UserCredentials) -> User | None:
        with Session(self._engine) as session:
            query = select(User).where(User.name == credentials.name)
            user = session.exec(query).one_or_none()
        if user is None:
            return None
        try:
            self._hasher.verify(user.password, credentials.password)
        except VerifyMismatchError:
            return None
        return user

    def create_user(self, data: UserCreation) -> User:
        # hash password before storing into database
        data.password = self._hasher.hash(data.password)
        # auto map UserCreate (DTO) to User (DO) model
        user = User.model_validate(data)
        # perform database operation
        try:
            with Session(self._engine) as session:
                session.add(user)
                session.commit()
                session.refresh(user)
        except IntegrityError:
            raise EntityExistsError()
        return user
