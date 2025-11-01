import io

import soundfile
from kokoro import KPipeline


class Pronouncer:
    REPO_ID = "hexgrad/Kokoro-82M"
    LANG_CODE = "en-us"

    VOICE = "af_heart"
    SPEED = 0.85

    SR = 24_000  # Kokoro's fixed sample rate

    def __init__(self):
        self._pipeline = KPipeline(
            repo_id=Pronouncer.REPO_ID,
            lang_code=Pronouncer.LANG_CODE,
        )

    def __call__(self, text: str) -> bytes:
        generator = self._pipeline(
            text,
            split_pattern=None,
            voice=Pronouncer.VOICE,
            speed=Pronouncer.SPEED,
        )
        with io.BytesIO() as buffer:
            _, _, audio = next(generator)  # only yields the first sentence
            soundfile.write(
                buffer,
                audio,
                format="wav",
                samplerate=Pronouncer.SR,
            )
            return buffer.getvalue()
