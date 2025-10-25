from pydantic.dataclasses import dataclass

from ..generators.feedback import FeedbackGenerator
from ..generators.transcript import Transcript
from .aligner import PhonemeAligner, Phonemes
from .processor import AudioProcessor


@dataclass
class Result:
    feedback: str | None
    phonemes: Phonemes


class Pipeline:
    def __init__(self):
        self.audio_processor = AudioProcessor()
        self.phoneme_aligner = PhonemeAligner()
        self.feedback_generator = FeedbackGenerator()

    def __call__(self, audio: bytes, transcript: Transcript) -> Result | None:
        waveform = self.audio_processor(audio)
        if waveform is None:
            return None
        phonemes = self.phoneme_aligner(waveform, transcript)
        feedback = self.feedback_generator(transcript, phonemes)
        return Result(feedback=feedback, phonemes=phonemes)
