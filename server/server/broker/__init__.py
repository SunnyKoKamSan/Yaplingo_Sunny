from datetime import timedelta
from typing import Any, Generic, ParamSpec, TypeVar, overload

from pydantic import BaseModel, ConfigDict
from taskiq import AsyncTaskiqDecoratedTask, AsyncTaskiqTask, TaskiqEvents, TaskiqState
from taskiq_redis import RedisAsyncResultBackend, RedisStreamBroker
from ulid import ULID

from server.core.pipeline import Pipeline

from .settings import settings

P = ParamSpec("P")
T = TypeVar("T")
M = TypeVar("M", bound=BaseModel)


class Task(Generic[T]):
    def __init__(self, broker: "Broker", task: AsyncTaskiqTask[T]):
        self._task = task
        self._broker = broker

    @overload
    async def recall(
        self,
        model: type[M],
    ) -> M: ...

    @overload
    async def recall(
        self,
        model: None = None,
    ) -> Any: ...

    async def recall(self, model: type[M] | None = None) -> M | T:
        result = await self._task.wait_result()
        if result.is_err and result.error is not None:
            raise result.error
        if model is not None and issubclass(model, BaseModel):
            if result.return_value is not None:
                return model.model_validate(result.return_value)
        return result.return_value


class TaskResult(BaseModel, Generic[T]):
    pending: bool = True
    error: BaseException | None = None
    value: T | None = None

    model_config = ConfigDict(arbitrary_types_allowed=True)


class Broker:
    broker = (
        RedisStreamBroker(
            url=str(settings.url),
        )
        .with_result_backend(
            RedisAsyncResultBackend(
                redis_url=str(settings.url),
                keep_results=True,
                result_ex_time=timedelta(hours=1).seconds,
            )
        )
        .with_id_generator(lambda: str(ULID()))
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
        task: AsyncTaskiqDecoratedTask[P, T],
        id: ULID | None = None,
        *args: P.args,
        **kwargs: P.kwargs,
    ) -> Task[T]:
        task_id = str(id) if id is not None else None
        kicker = task.kicker().with_task_id(task_id)
        return Task(self, await kicker.kiq(*args, **kwargs))

    @overload
    async def retrieve(self, id: ULID, model: type[M]) -> TaskResult[M | None] | None: ...

    @overload
    async def retrieve(self, id: ULID, model: None = None) -> TaskResult[Any] | None: ...

    async def retrieve(self, id: ULID, model: type[M] | None = None) -> TaskResult[M] | TaskResult[Any] | None:
        if not await self.broker.result_backend.is_result_ready(str(id)):
            return None
        result = await self.broker.result_backend.get_result(str(id))
        if result.is_err:
            return TaskResult(pending=False, error=result.error)
        value = result.return_value
        if model is not None and issubclass(model, BaseModel):
            if value is not None:
                value = model.model_validate(value)
        return TaskResult(pending=False, value=value)

    @overload
    async def execute(
        self,
        task: AsyncTaskiqDecoratedTask[P, T],
        model: type[M],
        id: ULID | None = None,
        *args: P.args,
        **kwargs: P.kwargs,
    ) -> M | None: ...

    @overload
    async def execute(
        self,
        task: AsyncTaskiqDecoratedTask[P, T],
        model: None = None,
        id: ULID | None = None,
        *args: P.args,
        **kwargs: P.kwargs,
    ) -> Any: ...

    async def execute(
        self,
        task: AsyncTaskiqDecoratedTask[P, T],
        model: type[M] | None = None,
        id: ULID | None = None,
        *args: P.args,
        **kwargs: P.kwargs,
    ) -> M | T | None:
        t = await self.kickstart(task, id=id, *args, **kwargs)
        return await t.recall(model)


broker = Broker.broker

__all__ = ["broker", "Broker", "TaskResult"]
