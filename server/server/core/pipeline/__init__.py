from pydantic.dataclasses import dataclass

from ..generators.feedback import FeedbackGenerator
from ..generators.transcript import Transcript
from .aligner import PhonemeAligner, Phonemes
from .processor import AudioProcessor


@dataclass(kw_only=True)
class Result:
    feedback: str
    phonemes: Phonemes


class Pipeline:
    def __init__(self, do_noise_filter: bool = True):
        self.audio_processor = AudioProcessor(use_df=do_noise_filter)
        self.phoneme_aligner = PhonemeAligner()
        self.feedback_generator = FeedbackGenerator()

    def __call__(self, audio: bytes, transcript: Transcript) -> Result | None:
        waveform = self.audio_processor(audio)
        if waveform is None:
            return None
        phonemes = self.phoneme_aligner(waveform, transcript)
        feedback = self.feedback_generator(transcript, phonemes)
        return Result(feedback=feedback, phonemes=phonemes)
