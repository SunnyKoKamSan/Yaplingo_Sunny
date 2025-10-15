from .generators.transcript import Transcript, TranscriptGenerator
from .pipeline import Pipeline
from .pipeline import Result as PipelineResult
from .pronouncer import Pronouncer


class Yaplingo:
    def __init__(self):
        self._pipeline = Pipeline()
        self._pronouncer = Pronouncer()
        self._transcript_generator = TranscriptGenerator()

    def get_pronunciation(self, text: str) -> bytes:
        return self._pronouncer(text)

    def generate_transcript(self) -> Transcript:
        return self._transcript_generator()

    def analyze(self, audio: bytes, transcript: Transcript) -> PipelineResult | None:
        return self._pipeline(audio, transcript)


__all__ = ["Yaplingo", "Transcript", "PipelineResult"]
