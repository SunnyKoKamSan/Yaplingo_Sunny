from typing import Any, Generic, TypeVar

from pydantic import BaseModel, ConfigDict
from taskiq import AsyncTaskiqDecoratedTask, TaskiqEvents, TaskiqState
from taskiq_redis import RedisAsyncResultBackend, RedisStreamBroker
from ulid import ULID

from server.core.pipeline import Pipeline

from .settings import settings

T = TypeVar("T", bound=BaseModel)


class Task(BaseModel, Generic[T]):
    pending: bool = True
    error: BaseException | None = None
    value: T | None = None

    model_config = ConfigDict(arbitrary_types_allowed=True)


class Broker:
    broker = RedisStreamBroker(
        url=str(settings.url),
    ).with_result_backend(
        RedisAsyncResultBackend(
            redis_url=str(settings.url),
        )
    )

    @staticmethod
    @broker.on_event(TaskiqEvents.WORKER_STARTUP)
    async def startup(state: TaskiqState):
        state.pipeline = Pipeline()

    @classmethod
    async def create(cls):
        if not cls.broker.is_worker_process:
            await cls.broker.startup()
        return cls()

    async def dispose(self):
        if not self.broker.is_worker_process:
            await self.broker.shutdown()

    async def kickstart(
        self,
        task: AsyncTaskiqDecoratedTask,
        args: tuple[Any, ...] = (),
        kwargs: dict[str, Any] = {},
        id: ULID = ULID(),
    ) -> None:
        kicker = task.kicker().with_task_id(str(id))
        await kicker.kiq(*args, **kwargs)

    async def retrieve(self, id: ULID, model: type[BaseModel]) -> Task[Any] | None:
        if not await self.broker.result_backend.is_result_ready(str(id)):
            return None
        result = await self.broker.result_backend.get_result(str(id))
        if result.is_err:
            return Task(pending=False, error=result.error)
        value = result.return_value  # `return_value` is dict and not yet deserialized into Pydantic model
        return Task(pending=False, value=model.model_validate(value) if value is not None else None)


broker = Broker.broker

__all__ = ["broker", "Broker", "Task"]
