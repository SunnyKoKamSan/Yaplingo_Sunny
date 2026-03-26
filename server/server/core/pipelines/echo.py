from typing import overload

from .._utils import waveform_to_audio_b64
from ..models.echo import Result, Scenario, Transcript
from . import Pipeline


class EchoPipeline(Pipeline):
    def __initialize__(self):
        from ..aligner import PronunciationAligner
        from ..generators.echo import FeedbackGenerator, ScenarioGenerator
        from ..processor import AudioProcessor

        self.audio_processor = AudioProcessor(sr=PronunciationAligner.SR)
        self.pronunciation_aligner = PronunciationAligner()
        self.feedback_generator = FeedbackGenerator()
        self.scenario_generator = ScenarioGenerator()

    @overload
    async def __call__(self) -> Scenario: ...

    @overload
    async def __call__(self, audio: bytes, transcript: Transcript) -> Result | None: ...

    async def __call__(
        self,
        audio: bytes | None = None,
        transcript: Transcript | None = None,
    ) -> Scenario | (Result | None):
        # no args provided: generate scenario
        if audio is None and transcript is None:
            return await self.scenario_generator()
        # both audio and transcript provided: analyze echo
        if audio is not None and transcript is not None:
            if (waveform := self.audio_processor(audio)) is None:
                return None
            audio_b64 = waveform_to_audio_b64(waveform, self.audio_processor.sr)
            pronunciation = self.pronunciation_aligner(waveform, transcript)
            feedback = await self.feedback_generator(transcript, pronunciation)
            return Result(audio_b64=audio_b64, feedback=feedback, pronunciation=pronunciation)

        raise ValueError("no overload matched for given arguments")
