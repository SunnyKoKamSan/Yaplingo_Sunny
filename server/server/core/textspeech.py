import base64
import io

import soundfile
from kokoro import KPipeline


class KokoroTextSpeech:
    REPO_ID = "hexgrad/Kokoro-82M"
    LANG_CODE = "en-us"

    VOICE = "af_heart"
    SPEED = 0.85

    SR = 24_000  # Kokoro's fixed sample rate

    def __init__(self):
        self._pipeline = KPipeline(
            repo_id=KokoroTextSpeech.REPO_ID,
            lang_code=KokoroTextSpeech.LANG_CODE,
        )

    def __call__(self, text: str) -> str:
        generator = self._pipeline(
            text,
            split_pattern=None,
            voice=KokoroTextSpeech.VOICE,
            speed=KokoroTextSpeech.SPEED,
        )
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
