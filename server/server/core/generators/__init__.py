from abc import ABC, abstractmethod

from openai import AsyncOpenAI
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_id: str = "ai/llama3.1"
    base_url: str = "http://model-runner.docker.internal/engines/v1"
    api_key: str = ""

    model_config = SettingsConfigDict(env_prefix="llm_")


settings = Settings.model_validate({})


class Generator(ABC):
    def __init__(self):
        self._client = AsyncOpenAI(base_url=settings.base_url, api_key=settings.api_key)

    @property
    @abstractmethod
    def system_prompt(self) -> str:
        raise NotImplementedError

    async def __call__(self, prompt: str, **kwargs) -> str:
        completion = await self._client.chat.completions.create(
            model=settings.model_id,
            messages=[
                {"role": "system", "content": self.system_prompt},
                {"role": "user", "content": prompt},
            ],
            **kwargs,
        )
        return completion.choices[0].message.content or ""
