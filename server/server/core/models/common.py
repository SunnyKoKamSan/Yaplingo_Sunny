import re
from typing import TYPE_CHECKING

from phonemizer import phonemize
from phonemizer.punctuation import Punctuation
from phonemizer.separator import Separator
from pydantic import BaseModel, Field, PrivateAttr, computed_field
from typing_extensions import Self

from .._utils import cached_method, data_urlencode
from ..levenshtein import OperationCode, levenshtein
from ..textspeech import gtts

if TYPE_CHECKING:
    cached_property = property
else:
    from functools import cached_property


SEPARATOR = Separator(phone="/", word=" ")
PUNCTUATION = Punctuation()

DIFFERENCE_CUTOFF = 0.75  # for filtering out differences with high enough confidence


class Transcript(BaseModel):
    text: str
    audio: str | None = Field(default=None, repr=False)

    @computed_field
    @cached_property
    def sequence(self) -> str:
        phonemes = phonemize(
            self.text,
            strip=True,
            with_stress=False,
            preserve_punctuation=True,
            separator=SEPARATOR,
            language="en-us",
            backend="espeak",
        )
        return str(phonemes)

    @cached_property
    def phonemes(self) -> list[str]:
        sequence = Punctuation().remove(self.sequence)
        return re.split(r"[/ ]+", str(sequence).strip())

    @cached_method
    def get_word_boundaries(self) -> list[tuple[str, int, int]]:
        index = 0
        boundaries = []
        words = str(PUNCTUATION.remove(self.text)).split()
        phonemes = str(PUNCTUATION.remove(self.sequence)).split()
        for word, phones in zip(words, phonemes):
            start = index
            index += len(phones.split("/"))
            boundaries.append((word, start, index))
        return boundaries

    # cannot decorate with `cached_method` here because this method is async
    #   and would cause "RuntimeError: cannot reuse already awaited coroutine"
    async def get_audio(self) -> str:
        if self.audio is None:
            self.audio = data_urlencode(await gtts(self.text), gtts.MIME)
        return self.audio


class Pronunciation(BaseModel):
    _transcript: Transcript = PrivateAttr()  # ref: https://github.com/pydantic/pydantic/issues/9048

    class Alignment(BaseModel):
        token: str
        score: float
        interval: tuple[int, int]

    class Difference(BaseModel):
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

    class WordSpan(BaseModel):
        phonemes: list[str]
        alignments: list["Pronunciation.Alignment"]
        differences: list["Pronunciation.Difference"]

        @computed_field
        @cached_property
        def score(self) -> float:
            return sum(a.score for a in self.alignments) / len(self.alignments)

    phonemes: list[str]
    alignments: list[Alignment]

    def with_transcript(self, transcript: Transcript) -> Self:
        self._transcript = transcript
        return self

    # FIXME: need fixing for edge cases
    @computed_field
    @cached_property
    def differences(self) -> list[Difference]:
        differences = []
        boundaries = self._transcript.get_word_boundaries()
        _, _, operations = levenshtein(self._transcript.phonemes, self.phonemes)
        for opcode, i, j in operations:
            if self.alignments[i].score >= DIFFERENCE_CUTOFF:
                continue  # skip phonemes with high enough confidence (consider them as correct)
            for word, start, end in boundaries:
                if start <= i < end:
                    differences.append(
                        Pronunciation.Difference(
                            word=word,
                            operation=opcode,
                            expected=self._transcript.phonemes[i] if opcode != "+" else None,
                            predicted=self.phonemes[j] if opcode != "-" else None,
                        )
                    )
                    break
            else:
                # FIXME: find a way to prevent this
                raise RuntimeError("could not match word boundary for difference")
        return differences

    # FIXME: need fixing for edge cases
    @computed_field
    @cached_property
    def words(self) -> list[tuple[str, WordSpan]]:
        boundaries = self._transcript.get_word_boundaries()
        _, phonemes, _ = levenshtein(self._transcript.phonemes, self.phonemes)
        return [
            (
                word,
                Pronunciation.WordSpan(
                    phonemes=[p for p in phonemes[start:end] if p],
                    alignments=self.alignments[start:end],
                    differences=[d for d in self.differences if d.word == word],
                ),
            )
            for word, start, end in boundaries
        ]

    @computed_field
    @cached_property
    def score(self) -> float:
        return sum(a.score for a in self.alignments) / len(self.alignments)


class Insights(BaseModel):
    class PhonemeError(BaseModel):
        """Represents a frequently occurring phoneme error pattern."""

        phoneme: str
        expected: str | None
        predicted: str | None
        operation: str  # replace, insert, delete
        count: int

    class WordError(BaseModel):
        """Represents a word that consistently causes pronunciation difficulty."""

        word: str
        average: float
        count: int

    """Aggregated pronunciation statistics from user's sessions."""

    average: float
    phoneme_errors: list[PhonemeError]  # top N most frequent
    word_errors: list[WordError]  # top N lowest scoring

    # TODO: to be improved
    def format(self) -> str:
        """Format into a human-readable string for LLM scenario prompts."""
        lines = []
        if self.word_errors:
            words = ", ".join(f'"{e.word}"' for e in self.word_errors[:5])
            lines.append(f"Frequently mispronounced words: {words}")
        if self.phoneme_errors:
            sounds = []
            for e in self.phoneme_errors[:5]:
                if e.operation == "replace" and e.expected and e.predicted:
                    sounds.append(f"/{e.expected}/ (often pronounced as /{e.predicted}/)")
                elif e.operation == "delete" and e.expected:
                    sounds.append(f"/{e.expected}/ (often dropped)")
                elif e.operation == "insert" and e.predicted:
                    sounds.append(f"/{e.predicted}/ (often inserted)")
            if sounds:
                lines.append(f"Problematic sounds: {', '.join(sounds)}")
        return "\n".join(lines)
