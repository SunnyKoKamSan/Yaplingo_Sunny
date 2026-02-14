import asyncio
from abc import ABC, abstractmethod

from openai import APIConnectionError, APIStatusError, APITimeoutError, AsyncOpenAI, RateLimitError
from pydantic_settings import BaseSettings, SettingsConfigDict

RETRYABLE_STATUS_CODES = {408, 409, 425, 429, 500, 502, 503, 504}
MAX_RETRY_ATTEMPTS = 5
MAX_RETRY_DELAY_SECONDS = 8.0


class Settings(BaseSettings):
    model_id: str = "ai/llama3.1"
    base_url: str = "http://model-runner.docker.internal/engines/v1"
    api_key: str = ""

    model_config = SettingsConfigDict(env_prefix="llm_")


settings = Settings.model_validate({})


class LLMTransientError(RuntimeError):
    """Raised when the upstream LLM is temporarily unavailable after retries."""


def is_retryable_llm_error(error: Exception) -> bool:
    if isinstance(error, (APIConnectionError, APITimeoutError, RateLimitError)):
        return True
    return isinstance(error, APIStatusError) and error.status_code in RETRYABLE_STATUS_CODES


class Generator(ABC):
    def __init__(self):
        self._client = AsyncOpenAI(base_url=settings.base_url, api_key=settings.api_key)

    @property
    @abstractmethod
    def system_prompt(self) -> str:
        raise NotImplementedError

    async def __call__(self, prompt: str, **kwargs) -> str:
        for attempt in range(1, MAX_RETRY_ATTEMPTS + 1):
            try:
                completion = await self._client.chat.completions.create(
                    model=settings.model_id,
                    messages=[
                        {"role": "system", "content": self.system_prompt},
                        {"role": "user", "content": prompt},
                    ],
                    **kwargs,
                )
                return completion.choices[0].message.content or ""
            except (APIConnectionError, APITimeoutError, RateLimitError, APIStatusError) as error:
                if not is_retryable_llm_error(error):
                    raise
                if attempt == MAX_RETRY_ATTEMPTS:
                    raise LLMTransientError("Upstream LLM temporarily unavailable") from error
                retry_delay = min((2 ** (attempt - 1)) * 0.5, MAX_RETRY_DELAY_SECONDS)
                await asyncio.sleep(retry_delay)
