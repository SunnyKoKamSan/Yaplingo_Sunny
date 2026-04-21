import io
import json
from abc import ABC, abstractmethod
from collections.abc import AsyncIterator
from functools import partial

import httpx


class BaseTextSpeech(ABC):
    MIME: str

    @abstractmethod
    async def __call__(self, text: str) -> bytes | AsyncIterator[bytes]: ...


class GoogleTextSpeech(BaseTextSpeech):
    MIME = "audio/mpeg"

    def __init__(self):
        from gtts import agTTS

        self.synthesize = partial(agTTS, lang="en", tld="us", slow=False)

    async def __call__(self, text: str) -> bytes:
        buffer = io.BytesIO()
        await self.synthesize(text).write_to_fp(buffer)
        return buffer.getvalue()


class DeepgramTextSpeech(BaseTextSpeech):
    """Streaming TTS via Deepgram REST API (aura model).

    Uses httpx directly instead of the Deepgram SDK because the SDK's
    speak.v1.audio.generate() buffers the entire response, whereas we
    need to stream audio chunks as they arrive from the API.
    """

    MIME = "audio/mpeg"

    API_BASE_URL = "https://api.deepgram.com/v1"
    MODEL = "aura-asteria-en"

    def __init__(self, api_key: str):
        self._client = httpx.AsyncClient(
            timeout=30.0,
            headers={
                "Authorization": f"Token {api_key}",
                "Content-Type": "application/json",
            },
            base_url=self.API_BASE_URL,
        )

    async def __call__(self, text: str) -> AsyncIterator[bytes]:
        text = text.replace('"', "")
        async with self._client.stream(
            "POST",
            "/speak",
            params={"model": self.MODEL, "encoding": "mp3"},
            content=json.dumps({"text": text}),
        ) as response:
            response.raise_for_status()
            async for chunk in response.aiter_bytes(chunk_size=4096):
                yield chunk


gtts = GoogleTextSpeech()
