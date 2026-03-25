from abc import ABC, abstractmethod
from typing import Any


class Pipeline(ABC):
    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance.__initialize__()
        return cls._instance

    @abstractmethod
    def __initialize__(self):
        pass

    @abstractmethod
    async def __call__(self, *args, **kwargs) -> Any: ...
