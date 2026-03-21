from abc import ABC, abstractmethod
from typing import Any


class Pipeline(ABC):
    __instance = None

    def __new__(cls):
        if cls.__instance is None:
            cls.__instance = super().__new__(cls)
            cls.__instance.__initialize__()
        return cls.__instance

    @abstractmethod
    def __initialize__(self):
        pass

    @abstractmethod
    async def __call__(self, *args, **kwargs) -> Any: ...
