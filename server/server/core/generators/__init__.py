import sys
from abc import ABC, abstractmethod
from pathlib import Path
from datetime import datetime, timedelta, timezone
import logging
from typing import Any

from openai import APIConnectionError, APIStatusError, APITimeoutError, AsyncOpenAI
from pydantic_settings import BaseSettings, SettingsConfigDict

IS_RELOAD_ENABLED = "--reload" in sys.argv
logger = logging.getLogger(__name__)

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


class LLMUnavailableError(RuntimeError):
    pass


class BaseGenerator(ABC):
    SYSTEM_PROMPT_FILE_PATH: Path
    _llm_backoff_until: datetime | None = None

    def __init__(self):
        self.client = client

    @classmethod
    def _is_llm_temporarily_disabled(cls) -> bool:
        until = cls._llm_backoff_until
        if until is None:
            return False
        return datetime.now(timezone.utc) < until

    @classmethod
    def _mark_llm_unavailable(cls, reason: str) -> None:
        cls._llm_backoff_until = datetime.now(timezone.utc) + timedelta(seconds=30)
        logger.warning("LLM temporarily unavailable (%s). Falling back for 30 seconds.", reason)

    @reloadable_property
    def system_prompt(self) -> str:
        return self.SYSTEM_PROMPT_FILE_PATH.read_text(encoding="utf-8").strip()

    async def call(self, prompt: str, **kwargs) -> str:
        if self._is_llm_temporarily_disabled():
            raise LLMUnavailableError("LLM circuit breaker active")

        try:
            completion = await self.client.chat.completions.create(
                model=settings.model_id,
                messages=[
                    {"role": "system", "content": self.system_prompt},
                    {"role": "user", "content": prompt},
                ],
                **kwargs,
            )
        except (APIConnectionError, APITimeoutError) as exc:
            self._mark_llm_unavailable(type(exc).__name__)
            raise LLMUnavailableError("LLM connection failed") from exc
        except APIStatusError as exc:
            if exc.status_code >= 500:
                self._mark_llm_unavailable(f"HTTP {exc.status_code}")
                raise LLMUnavailableError("LLM returned server error") from exc
            raise

        content = completion.choices[0].message.content
        if content is None or not content.strip():
            raise RuntimeError("LLM completion returned empty content")
        return content

    @abstractmethod
    async def __call__(self, *args, **kwargs) -> Any: ...
