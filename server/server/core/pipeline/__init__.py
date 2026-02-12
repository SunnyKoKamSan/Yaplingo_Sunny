from pydantic.dataclasses import dataclass

from ..generators.feedback import Feedback, FeedbackGenerator
from ..generators.transcript import Transcript
from .aligner import Pronunciation, PronunciationAligner
from .processor import AudioProcessor


@dataclass(kw_only=True)
class Result:
    feedback: Feedback
    pronunciation: Pronunciation


class Pipeline:
    def __init__(self, do_noise_filter: bool = True):
        self.audio_processor = AudioProcessor(use_df=do_noise_filter)
        self.pronunciation_aligner = PronunciationAligner()
        self.feedback_generator = FeedbackGenerator()

    async def __call__(self, audio: bytes, transcript: Transcript) -> Result | None:
        waveform = self.audio_processor(audio)
        if waveform is None:
            return None
        pronunciation = self.pronunciation_aligner(waveform, transcript)
        if pronunciation is None:
            return None
        try:
            feedback = await self.feedback_generator(transcript, pronunciation)
        except Exception as e:
            # LLM call or difference analysis can fail — return result with fallback feedback
            print(f"[Pipeline] feedback generation failed: {e}")
            feedback = Feedback(text="Great attempt! Keep practising to improve your pronunciation.", audio="")
        return Result(feedback=feedback, pronunciation=pronunciation)
