from .generators.feedback import Feedback
from .generators.transcript import Transcript, TranscriptGenerator, Transcripts
from .pipeline import Pipeline, Result


class Yaplingo:
    def __init__(self):
        self._pipeline = Pipeline()
        self._transcript_generator = TranscriptGenerator()

    def analyze_audio(self, audio: bytes, transcript: Transcript) -> Result | None:
        return self._pipeline(audio, transcript)

    def generate_transcripts(self) -> Transcripts:
        return self._transcript_generator()


__all__ = ["Yaplingo", "Result", "Transcript", "Transcripts", "Feedback"]
