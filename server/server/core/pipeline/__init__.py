from ..models import Result, Transcript


class Pipeline:
    __instance = None

    def __new__(cls):
        if cls.__instance is None:
            cls.__instance = super().__new__(cls)
            cls.__instance.__initialize__()
        return cls.__instance

    def __initialize__(self):
        from ..generators.feedback import FeedbackGenerator
        from .aligner import PronunciationAligner
        from .processor import AudioProcessor

        self.audio_processor = AudioProcessor()
        self.pronunciation_aligner = PronunciationAligner()
        self.feedback_generator = FeedbackGenerator()

    async def __call__(self, audio: bytes, transcript: Transcript) -> Result | None:
        if (waveform := self.audio_processor(audio)) is not None:
            pronunciation = self.pronunciation_aligner(waveform, transcript)
            feedback = await self.feedback_generator(transcript, pronunciation)
            return Result(feedback=feedback, pronunciation=pronunciation)
