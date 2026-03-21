import torch
import torchaudio
from transformers import Wav2Vec2ForCTC, Wav2Vec2PhonemeCTCTokenizer, Wav2Vec2Processor

from .models.echo import Pronunciation, Transcript


class PronunciationAligner:
    MODEL_ID = "facebook/wav2vec2-lv-60-espeak-cv-ft"
    SR = 16_000

    def __init__(self):
        self.model = Wav2Vec2ForCTC.from_pretrained(PronunciationAligner.MODEL_ID)
        self.processor = Wav2Vec2Processor.from_pretrained(PronunciationAligner.MODEL_ID)
        self.tokenizer = Wav2Vec2PhonemeCTCTokenizer.from_pretrained(PronunciationAligner.MODEL_ID)

    def perform_inference(self, waveform: torch.Tensor) -> torch.Tensor:
        inputs = self.processor(
            waveform,
            sampling_rate=PronunciationAligner.SR,
            return_tensors="pt",  # required
        )
        with torch.inference_mode():
            return self.model(**inputs).logits

    def predict_phonemes(self, logits: torch.Tensor) -> list[str]:
        predictions = logits.argmax(dim=-1)
        [phonemes] = self.tokenizer.batch_decode(predictions)
        return phonemes.split()

    def align_phonemes(self, logits: torch.Tensor, transcript: Transcript) -> list[Pronunciation.Alignment]:
        tokens = self.tokenizer(transcript.text).input_ids
        tokens = torch.tensor([tokens], dtype=torch.int32)
        log_probs = logits.log_softmax(dim=-1)
        [alignments], [scores] = torchaudio.functional.forced_align(log_probs, tokens)
        spans = torchaudio.functional.merge_tokens(alignments, scores.exp())
        return [
            Pronunciation.Alignment(
                token=self.tokenizer.convert_ids_to_tokens(s.token),
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
        pronunciation = Pronunciation(
            phonemes=predicted_phonemes,
            alignments=aligned_phonemes,
        ).with_transcript(transcript)
        return pronunciation
