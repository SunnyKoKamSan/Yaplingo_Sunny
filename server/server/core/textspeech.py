import asyncio
import base64
import io
from abc import ABC, abstractmethod
from functools import partial

import soundfile


def data_urlencode(data: bytes, mime: str) -> str:
    encoded = base64.b64encode(data).decode()
    return f"data:{mime};base64,{encoded}"


class BaseTextSpeech(ABC):
    MIME: str

    @abstractmethod
    async def __call__(self, text: str) -> bytes: ...


class GoogleTextSpeech(BaseTextSpeech):
    MIME = "audio/mpeg"

    def __init__(self):
        from gtts import agTTS

        self.synthesize = partial(agTTS, lang="en", tld="us", slow=False)

    async def __call__(self, text: str) -> bytes:
        buffer = io.BytesIO()
        await self.synthesize(text).write_to_fp(buffer)
        return buffer.getvalue()


class KokoroTextSpeech(BaseTextSpeech):
    MIME = "audio/wav"

    def __init__(self):
        from kokoro import KPipeline

        pipeline = KPipeline(
            repo_id="hexgrad/Kokoro-82M",
            lang_code="en-us",
        )
        self.generator = partial(
            pipeline,
            split_pattern=None,
            voice="af_heart",
            speed=1.0,
        )

    async def __call__(self, text: str) -> bytes:
        def _synthesize():
            generator = self.generator(text)
            with io.BytesIO() as buffer:
                _, _, audio = next(generator)  # only yields the first sentence
                soundfile.write(
                    buffer,
                    audio,
                    format="wav",
                    samplerate=24_000,  # Kokoro's fixed sample rate
                )
                return buffer.getvalue()

        return await asyncio.to_thread(_synthesize)


gtts = GoogleTextSpeech()
