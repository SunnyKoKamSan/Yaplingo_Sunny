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
        self._gtts = partial(gTTS, lang="en", slow=True)

    def __call__(self, text: str) -> str:
        buffer = io.BytesIO()
        self._gtts(text).write_to_fp(buffer)
        data = buffer.getvalue()
        encoded = base64.b64encode(data).decode("utf-8")
        return f"data:audio/mpeg;base64,{encoded}"


class KokoroTextSpeech(BaseTextSpeech):
    REPO_ID = "hexgrad/Kokoro-82M"
    LANG_CODE = "en-us"

    VOICE = "af_heart"
    SPEED = 0.85

    SR = 24_000  # Kokoro's fixed sample rate

    def __init__(self):
        pipeline = KPipeline(
            repo_id=KokoroTextSpeech.REPO_ID,
            lang_code=KokoroTextSpeech.LANG_CODE,
        )
        self._generator = partial(
            pipeline,
            split_pattern=None,
            voice=KokoroTextSpeech.VOICE,
            speed=KokoroTextSpeech.SPEED,
        )

    def __call__(self, text: str) -> str:
        generator = self._generator(text)
        with io.BytesIO() as buffer:
            _, _, audio = next(generator)  # only yields the first sentence
            soundfile.write(
                buffer,
                audio,
                format="wav",
                samplerate=KokoroTextSpeech.SR,
            )
            data = buffer.getvalue()
            encoded = base64.b64encode(data).decode("utf-8")
            return f"data:audio/wav;base64,{encoded}"


ktts = KokoroTextSpeech()
gtts = GoogleTextSpeech()

__all__ = ["ktts", "gtts"]
