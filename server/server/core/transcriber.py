import torch
from faster_whisper import WhisperModel

from ._utils import log_execution_time


class SpeechTranscriber:
    MODEL_ID = "distil-small.en"
    SR = 16_000

    def __init__(self):
        self.model = WhisperModel(SpeechTranscriber.MODEL_ID, compute_type="int8")

    @log_execution_time
    def __call__(self, waveform: torch.Tensor) -> str:
        segments, _ = self.model.transcribe(
            waveform.numpy(),
            language="en",
            multilingual=False,
        )
        return " ".join([s.text for s in segments])
