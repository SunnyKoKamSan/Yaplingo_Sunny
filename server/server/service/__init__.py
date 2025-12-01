from functools import cached_property

from server.repository import Repository
from server.store import Store

from .echo import EchoService
from .user import UserService


class Service:
    def __init__(self, store: Store, repository: Repository):
        self._store = store
        self._repository = repository

    @classmethod
    async def create(cls):
        store = await Store.create()
        repository = await Repository.create()
        return cls(store=store, repository=repository)

    async def dispose(self):
        await self._store.dispose()
        await self._repository.dispose()

    @cached_property
    def user(self):
        return UserService(store=self._store, repository=self._repository)

    @cached_property
    def echo(self):
        return EchoService(store=self._store, repository=self._repository)
