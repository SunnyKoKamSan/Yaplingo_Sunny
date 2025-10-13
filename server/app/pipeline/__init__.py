from dataclasses import dataclass

from ..generators.transcript import Transcript, TranscriptGenerator
from .aligner import PhonemeAligner, Phonemes
from .processor import AudioProcessor


@dataclass
class Result:
    feedback: str
    phonemes: Phonemes


class Pipeline:
    def __init__(self):
        self.audio_processor = AudioProcessor()
        self.phoneme_aligner = PhonemeAligner()
        self._transcript_generator = TranscriptGenerator()

    def generate_transcript(self) -> Transcript:
        return self._transcript_generator()

    def __call__(self, audio: bytes, transcript: Transcript) -> Result | None:
        waveform = self.audio_processor(audio)
        if waveform is None:
            return None
        phonemes = self.phoneme_aligner(waveform, transcript)
        print(" ".join(phonemes.predictions))
        print(phonemes.alignments)
        return Result(feedback="", phonemes=phonemes)
