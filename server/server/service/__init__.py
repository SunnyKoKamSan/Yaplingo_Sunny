from functools import cached_property

from server.broker import Broker
from server.repository import Repository
from server.store import Store

from .echo import EchoService
from .user import UserService


class Service:
    def __init__(self, broker: Broker, store: Store, repository: Repository):
        self._broker = broker
        self._store = store
        self._repository = repository

    @classmethod
    async def create(cls):
        broker = await Broker.create()
        store = await Store.create()
        repository = await Repository.create()
        return cls(broker=broker, store=store, repository=repository)

    async def dispose(self):
        await self._broker.dispose()
        await self._store.dispose()
        await self._repository.dispose()

    @cached_property
    def user(self) -> UserService:
        return UserService(store=self._store, repository=self._repository)

    @cached_property
    def echo(self) -> EchoService:
        return EchoService(broker=self._broker, store=self._store, repository=self._repository)


__all__ = ["Service"]
