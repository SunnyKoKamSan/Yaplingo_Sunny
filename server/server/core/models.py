import functools
import re
from functools import cached_property

from phonemizer import phonemize
from phonemizer.punctuation import Punctuation
from phonemizer.separator import Separator
from pydantic import BaseModel, Field, computed_field
from ulid import ULID

from .levenshtein import OperationCode, levenshtein
from .textspeech import data_urlencode, gtts

SEPARATOR = Separator(phone="/", word=" ")
PUNCTUATION = Punctuation()

DIFFERENCE_CUTOFF = 0.75  # for filtering out differences with high enough confidence


def cached_method(f):
    attr = f"@{f.__name__}"

    @functools.wraps(f)
    def wrapper(self):
        if hasattr(self, attr):
            return object.__getattribute__(self, attr)
        object.__setattr__(self, attr, result := f(self))
        return result

    return wrapper


class Transcript(BaseModel):
    id: ULID = Field(default_factory=ULID)
    text: str
    sequence: str
    audio: str

    @classmethod
    async def from_text(cls, text: str) -> "Transcript":
        sequence = phonemize(
            text,
            strip=True,
            with_stress=False,
            preserve_punctuation=True,
            separator=SEPARATOR,
            language="en-us",
            backend="espeak",
        )
        audio = data_urlencode(await gtts(text), gtts.MIME)
        return cls(text=text, sequence=str(sequence), audio=audio)

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


class Transcripts(BaseModel):
    topic: str
    scenario: str
    items: list[Transcript]


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


class Pronunciation(BaseModel):
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
            if self.alignments[i].score >= DIFFERENCE_CUTOFF:
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


class Result(BaseModel):
    feedback: str
    pronunciation: Pronunciation


__all__ = [
    "Transcript",
    "Transcripts",
    "Alignment",
    "Difference",
    "Pronunciation",
    "Result",
]
