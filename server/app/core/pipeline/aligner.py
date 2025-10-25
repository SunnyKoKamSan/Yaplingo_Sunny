from typing import Literal, cast

import Levenshtein
import torch
import torchaudio
from pydantic.dataclasses import dataclass
from transformers import Wav2Vec2ForCTC, Wav2Vec2PhonemeCTCTokenizer, Wav2Vec2Processor

from ..generators.transcript import Transcript
from .processor import AudioProcessor


@dataclass(frozen=True, kw_only=True)
class Difference:
    type: Literal["insert", "delete", "replace"]
    position: int  # wrt predictions
    predicted: str
    expected: str


@dataclass(frozen=True, kw_only=True)
class Alignment:
    token: str
    score: float
    interval: tuple[int, int]


@dataclass(frozen=True, kw_only=True)
class Phonemes:
    predictions: list[str]
    alignments: list[Alignment]
    differences: list[Difference]


class PhonemeAligner:
    MODEL_ID = "facebook/wav2vec2-lv-60-espeak-cv-ft"

    def __init__(self):
        self._model = Wav2Vec2ForCTC.from_pretrained(PhonemeAligner.MODEL_ID)
        self._processor = Wav2Vec2Processor.from_pretrained(PhonemeAligner.MODEL_ID)
        self._tokenizer = Wav2Vec2PhonemeCTCTokenizer.from_pretrained(PhonemeAligner.MODEL_ID)

    def perform_inference(self, waveform: torch.Tensor) -> torch.Tensor:
        inputs = self._processor(
            waveform,
            sampling_rate=AudioProcessor.SR,  # type: ignore[arg-type]
            return_tensors="pt",  # essential # type: ignore[arg-type]
        )
        with torch.inference_mode():
            return self._model(**inputs).logits

    def predict_phonemes(self, logits: torch.Tensor) -> list[str]:
        predictions = logits.argmax(dim=-1)
        [phonemes] = self._tokenizer.batch_decode(predictions)
        return phonemes.split()

    def align_phonemes(self, logits: torch.Tensor, transcript: Transcript) -> list[Alignment]:
        tokens = self._tokenizer(transcript.text).input_ids
        tokens = torch.tensor([tokens], dtype=torch.int32)

        log_probs = logits.log_softmax(dim=-1)

        [alignments], [scores] = torchaudio.functional.forced_align(log_probs, tokens)
        spans = torchaudio.functional.merge_tokens(alignments, scores.exp())

        return [
            Alignment(
                token=self._tokenizer.convert_ids_to_tokens(s.token),
                score=s.score,
                interval=(s.start, s.end),
            )
            for s in spans
        ]

    def compare_sequences(
        self,
        predicted_sequence: list[str],
        aligned_sequence: list[str],
    ) -> list[Difference]:
        editops = Levenshtein.editops(aligned_sequence, predicted_sequence)
        differences = [
            Difference(
                type=cast(Literal["insert", "delete", "replace"], op),
                position=dpos,
                predicted=predicted_sequence[dpos] if dpos < len(predicted_sequence) else "",
                expected=aligned_sequence[spos] if spos < len(aligned_sequence) else "",
            )
            for op, spos, dpos in editops
        ]
        return differences

    def __call__(self, waveform: torch.Tensor, transcript: Transcript) -> Phonemes:
        logits = self.perform_inference(waveform)
        predicted_phonemes = self.predict_phonemes(logits)
        aligned_phonemes = self.align_phonemes(logits, transcript)
        differences = self.compare_sequences(
            predicted_phonemes,
            [p.token for p in aligned_phonemes],
        )
        return Phonemes(
            predictions=predicted_phonemes,
            alignments=aligned_phonemes,
            differences=differences,
        )
