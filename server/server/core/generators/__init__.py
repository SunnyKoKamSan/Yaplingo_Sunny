import sys
from abc import ABC, abstractmethod
from pathlib import Path
from typing import Any

from openai import AsyncOpenAI
from pydantic_settings import BaseSettings, SettingsConfigDict

IS_RELOAD_ENABLED = "--reload" in sys.argv

if IS_RELOAD_ENABLED:
    reloadable_property = property
else:
    from functools import cached_property

    reloadable_property = cached_property


class Settings(BaseSettings):
    model_id: str = "ai/llama3.1"
    base_url: str = "http://model-runner.docker.internal/engines/v1"
    api_key: str = ""

    model_config = SettingsConfigDict(env_prefix="llm_")


settings = Settings.model_validate({})

client = AsyncOpenAI(base_url=settings.base_url, api_key=settings.api_key)


class BaseGenerator(ABC):
    SYSTEM_PROMPT_FILE_PATH: Path

    def __init__(self):
        self.client = client

    @reloadable_property
    def system_prompt(self) -> str:
        return self.SYSTEM_PROMPT_FILE_PATH.read_text(encoding="utf-8").strip()

    async def call(self, prompt: str, **kwargs) -> str:
        completion = await self.client.chat.completions.create(
            model=settings.model_id,
            messages=[
                {"role": "system", "content": self.system_prompt},
                {"role": "user", "content": prompt},
            ],
            **kwargs,
        )
        return completion.choices[0].message.content or ""

    @abstractmethod
    async def __call__(self, *args, **kwargs) -> Any: ...
