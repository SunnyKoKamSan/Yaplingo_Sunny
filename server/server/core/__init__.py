from .generators.transcript import Transcript, TranscriptGenerator
from .pipeline import Pipeline
from .pipeline import Result as PipelineResult
from .pronouncer import Pronouncer


class Yaplingo:
    def __init__(self):
        self._pipeline = Pipeline()
        self._pronouncer = Pronouncer()
        self._transcript_generator = TranscriptGenerator()

    def analyze(self, audio: bytes, transcript: Transcript) -> PipelineResult | None:
        return self._pipeline(audio, transcript)

    def generate_transcript(self) -> Transcript:
        return self._transcript_generator()

    def get_text_to_speech(self, text: str) -> bytes:
        return self._pronouncer(text)


__all__ = ["Yaplingo", "Transcript", "PipelineResult"]
