import base64
import io
from abc import ABC, abstractmethod
from functools import partial

import soundfile
from gtts import gTTS
from kokoro import KPipeline


class BaseTextSpeech(ABC):
    @abstractmethod
    def __call__(self, text: str) -> str:
        raise NotImplementedError


class GoogleTextSpeech(BaseTextSpeech):
    def __init__(self):
        self._gtts = partial(gTTS, lang="en", tld="us", slow=False)

    def __call__(self, text: str) -> str:
        buffer = io.BytesIO()
        self._gtts(text).write_to_fp(buffer)
        data = buffer.getvalue()
        encoded = base64.b64encode(data).decode("utf-8")
        return f"data:audio/mpeg;base64,{encoded}"


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

    def __call__(self, text: str) -> str:
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
            encoded = base64.b64encode(data).decode("utf-8")
            return f"data:audio/wav;base64,{encoded}"


ktts = KokoroTextSpeech()
gtts = GoogleTextSpeech()

__all__ = ["ktts", "gtts"]
