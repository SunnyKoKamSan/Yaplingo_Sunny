import asyncio
from typing import overload

from .._utils import waveform_to_audio_b64
from ..aligner import PronunciationAligner
from ..generators.chat import EvaluationGenerator, ReplyGenerator, ScenarioGenerator
from ..models.chat import Conversation, Result, Scenario, Transcript
from . import Pipeline


class ChatPipeline(Pipeline):
    def __initialize__(self):
        from ..processor import AudioProcessor
        from ..transcriber import SpeechTranscriber

        self.audio_processor = AudioProcessor(sr=SpeechTranscriber.SR)
        self.speech_transcriber = SpeechTranscriber()
        self.pronunciation_aligner = PronunciationAligner()
        self.scenario_generator = ScenarioGenerator()
        self.reply_generator = ReplyGenerator()
        self.evaluation_generator = EvaluationGenerator()

    @overload
    async def __call__(self) -> Scenario: ...

    @overload
    async def __call__(
        self,
        *,
        audio: bytes,
        scenario: Scenario,
        conversation: Conversation,
    ) -> Result | None: ...

    async def __call__(
        self,
        *,
        audio: bytes | None = None,
        scenario: Scenario | None = None,
        conversation: Conversation | None = None,
    ) -> Scenario | (Result | None):
        # no args provided: generate new scenario
        if scenario is None and conversation is None and audio is None:
            return await self.scenario_generator()
        # all args provided: analyze turn and generate reply
        elif scenario is not None and conversation is not None and audio is not None:
            if (waveform := self.audio_processor(audio)) is None:
                return None
            audio_b64 = waveform_to_audio_b64(waveform, self.audio_processor.sr)
            text = self.speech_transcriber(waveform)
            transcript = Transcript(text=text)
            context = Conversation.UserMessage(
                role="user",
                transcript=transcript,
            )
            conversation.messages.append(context)
            [reply, evaluation, pronunciation] = await asyncio.gather(
                self.reply_generator(scenario, conversation),
                self.evaluation_generator(scenario, conversation),
                asyncio.to_thread(self.pronunciation_aligner, waveform, transcript),
            )
            return Result(
                audio_b64=audio_b64,
                context=context,
                reply=Conversation.AssistantMessage(
                    role="assistant",
                    content=reply,
                ),
                evaluation=evaluation,
                pronunciation=pronunciation,
            )

        raise ValueError("no overload matched for given arguments")
