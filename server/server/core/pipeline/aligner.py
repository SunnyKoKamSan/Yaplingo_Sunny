from functools import cached_property

import torch
import torchaudio
from pydantic import computed_field
from pydantic.dataclasses import dataclass
from transformers import Wav2Vec2ForCTC, Wav2Vec2PhonemeCTCTokenizer, Wav2Vec2Processor

from ...utils import cached_method
from ..generators.transcript import Transcript
from ..levenshtein import OperationCode, levenshtein
from .processor import AudioProcessor

CONFIDENCE_THRESHOLD = 0.75  # for filtering out differences with high enough confidence


@dataclass(frozen=True, kw_only=True)
class Alignment:
    token: str
    score: float
    interval: tuple[int, int]


@dataclass(frozen=True, kw_only=True)
class Difference:
    word: str
    operation: OperationCode

    expected: str | None
    predicted: str | None

    def __str__(self) -> str:
        match self.operation:
            case "~":
                operation = "replace"
            case "+":
                operation = "insert"
            case "-":
                operation = "delete"
        return "\t".join([f'"{self.word}"', operation, f"{self.expected or '∅'} → {self.predicted or '∅'}"])


@dataclass(frozen=True, kw_only=True)
class Pronunciation:
    transcript: Transcript
    phonemes: list[str]  # predictions
    alignments: list[Alignment]

    @computed_field
    @cached_property
    def words(self) -> list[tuple[str, list[Alignment]]]:
        alignments = []
        boundaries = self.transcript.get_word_boundaries()
        for word, start, end in boundaries:
            alignments.append((word, self.alignments[start:end]))
        return alignments

    @cached_method
    def get_differences(self) -> list[Difference]:
        differences = []
        boundaries = self.transcript.get_word_boundaries()
        _, _, operations = levenshtein(self.transcript.phonemes, self.phonemes)
        for opcode, i, j in operations:
            if self.alignments[i].score >= CONFIDENCE_THRESHOLD:
                continue  # skip phonemes with high enough confidence (consider them as correct)
            for word, start, end in boundaries:
                if start <= i < end:
                    differences.append(
                        Difference(
                            word=word,
                            operation=opcode,
                            expected=self.transcript.phonemes[i] if opcode != "+" else None,
                            predicted=self.phonemes[j] if opcode != "-" else None,
                        )
                    )
                    break
            else:
                raise RuntimeError("could not match word boundary for difference")
        return differences


class PronunciationAligner:
    MODEL_ID = "facebook/wav2vec2-lv-60-espeak-cv-ft"

    def __init__(self):
        self._model = Wav2Vec2ForCTC.from_pretrained(PronunciationAligner.MODEL_ID)
        self._processor = Wav2Vec2Processor.from_pretrained(PronunciationAligner.MODEL_ID)
        self._tokenizer = Wav2Vec2PhonemeCTCTokenizer.from_pretrained(PronunciationAligner.MODEL_ID)

    def perform_inference(self, waveform: torch.Tensor) -> torch.Tensor:
        inputs = self._processor(
            waveform,
            sampling_rate=AudioProcessor.SR,
            return_tensors="pt",  # required
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

    def __call__(self, waveform: torch.Tensor, transcript: Transcript) -> Pronunciation:
        logits = self.perform_inference(waveform)
        predicted_phonemes = self.predict_phonemes(logits)
        aligned_phonemes = self.align_phonemes(logits, transcript)
        assert len(aligned_phonemes) == len(transcript.phonemes), (
            "alignment output must have the same length with the transcript"
        )
        return Pronunciation(
            transcript=transcript,
            phonemes=predicted_phonemes,
            alignments=aligned_phonemes,
        )
