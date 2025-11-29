import asyncio
import base64
import io
from abc import ABC, abstractmethod
from functools import partial

import soundfile
from gtts import agTTS
from kokoro import KPipeline


def data_urlencode(data: bytes, mime: str) -> str:
    encoded = base64.b64encode(data).decode("utf-8")
    return f"data:{mime};base64,{encoded}"


class BaseTextSpeech(ABC):
    @abstractmethod
    async def __call__(self, text: str) -> str:
        raise NotImplementedError


class GoogleTextSpeech(BaseTextSpeech):
    def __init__(self):
        self._synthesize = partial(agTTS, lang="en", tld="us", slow=False)

    async def __call__(self, text: str) -> str:
        buffer = io.BytesIO()
        await self._synthesize(text).write_to_fp(buffer)
        data = buffer.getvalue()
        return data_urlencode(data, mime="audio/mpeg")


class KokoroTextSpeech(BaseTextSpeech):
    def __init__(self):
        pipeline = KPipeline(
            repo_id="hexgrad/Kokoro-82M",
            lang_code="en-us",
        )
        self._generator = partial(
            pipeline,
            split_pattern=None,
            voice="af_heart",
            speed=1.0,
        )

    async def __call__(self, text: str) -> str:
        def _synthesize():
            generator = self._generator(text)
            with io.BytesIO() as buffer:
                _, _, audio = next(generator)  # only yields the first sentence
                soundfile.write(
                    buffer,
                    audio,
                    format="wav",
                    samplerate=24_000,  # Kokoro's fixed sample rate
                )
                data = buffer.getvalue()
                return data_urlencode(data, mime="audio/wav")

        return await asyncio.to_thread(_synthesize)


ktts = KokoroTextSpeech()
gtts = GoogleTextSpeech()

__all__ = ["ktts", "gtts"]
