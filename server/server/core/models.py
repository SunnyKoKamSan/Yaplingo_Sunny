import functools
import re

from isodate.version import TYPE_CHECKING
from phonemizer import phonemize
from phonemizer.punctuation import Punctuation
from phonemizer.separator import Separator
from pydantic import BaseModel, PrivateAttr, computed_field

from server.core.textspeech import data_urlencode, gtts

from .levenshtein import OperationCode, levenshtein

if TYPE_CHECKING:
    cached_property = property
else:
    from functools import cached_property


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
    text: str

    @computed_field
    @cached_property
    def sequence(self) -> str:
        return str(
            phonemize(
                self.text,
                strip=True,
                with_stress=False,
                preserve_punctuation=True,
                separator=SEPARATOR,
                language="en-us",
                backend="espeak",
            )
        )

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
        attr = "@audio"
        if hasattr(self, attr):
            audio = object.__getattribute__(self, attr)
        else:
            audio = data_urlencode(await gtts(self.text), gtts.MIME)
            object.__setattr__(self, attr, audio)
        return audio


class Transcripts(BaseModel):
    topic: str
    scenario: str
    items: list[Transcript]


class Pronunciation(BaseModel):
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

    _transcript: Transcript = PrivateAttr()

    phonemes: list[str]  # predictions
    alignments: list[Alignment]

    @computed_field
    @cached_property
    def words(self) -> list[tuple[str, list[Alignment]]]:
        alignments = []
        boundaries = self._transcript.get_word_boundaries()
        for word, start, end in boundaries:
            alignments.append((word, self.alignments[start:end]))
        return alignments

    @cached_method
    def get_differences(self) -> list[Difference]:
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
                raise RuntimeError("could not match word boundary for difference")
        return differences

    def with_transcript(self, transcript: Transcript) -> "Pronunciation":
        self._transcript = transcript
        return self


class Result(BaseModel):
    feedback: str
    pronunciation: Pronunciation


__all__ = [
    "Transcript",
    "Transcripts",
    "Pronunciation",
    "Result",
]
