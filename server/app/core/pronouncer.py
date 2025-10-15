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


# class Pronouncer:
#     VOICE = "en_US-amy-medium"
#     PATH = Path("~/.cache").expanduser() / "piper" / "voices"

#     def __init__(self):
#         Pronouncer.PATH.mkdir(parents=True, exist_ok=True)
#         download_voice(Pronouncer.VOICE, Pronouncer.PATH)
#         self._voice = PiperVoice.load(Pronouncer.PATH / f"{Pronouncer.VOICE}.onnx")
#         self._config = SynthesisConfig(
#             volume=1.0,
#             length_scale=1.0,
#             noise_scale=1.5,
#             noise_w_scale=1.0,
#             normalize_audio=True,
#         )

#     def __call__(self, text: str) -> bytes:
#         with io.BytesIO() as buffer:
#             with wave.open(buffer, "wb") as wav:
#                 chunks = self._voice.synthesize(text, self._config)
#                 for i, chunk in enumerate(chunks):
#                     if i == 0:
#                         wav.setframerate(chunk.sample_rate)
#                         wav.setsampwidth(chunk.sample_width)
#                         wav.setnchannels(chunk.sample_channels)
#                     wav.writeframes(chunk.audio_int16_bytes)
#             buffer.seek(0)
#             return buffer.getvalue()
