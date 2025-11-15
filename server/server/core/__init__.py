from .generators.transcript import Transcript, TranscriptGenerator
from .pipeline import Pipeline, Result


class Yaplingo:
    def __init__(self):
        self._pipeline = Pipeline()
        self._transcript_generator = TranscriptGenerator()

    def analyze_audio(self, audio: bytes, transcript: Transcript) -> Result | None:
        return self._pipeline(audio, transcript)

    def generate_transcript(self) -> Transcript:
        return self._transcript_generator()


__all__ = ["Yaplingo", "Transcript", "Result"]
