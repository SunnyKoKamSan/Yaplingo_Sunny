import re
from functools import cached_property

from phonemizer import phonemize
from phonemizer.punctuation import Punctuation
from phonemizer.separator import Separator
from pydantic import computed_field
from pydantic.dataclasses import dataclass
from ulid import ULID

from ...utils import cached_method
from ..textspeech import gtts
from . import Generator

PHONEMIZER_SEPARATOR = Separator(phone="/", word=" ")


@dataclass(frozen=True, kw_only=True)
class Transcript:
    id: ULID
    text: str
    sequence: str

    @classmethod
    def from_text(cls, text: str):
        sequence = phonemize(
            text,
            strip=True,
            with_stress=False,
            preserve_punctuation=True,
            separator=PHONEMIZER_SEPARATOR,
            language="en-us",
            backend="espeak",
        )
        return cls(id=ULID(), text=text, sequence=str(sequence))

    @cached_property
    def phonemes(self) -> list[str]:
        sequence = Punctuation().remove(self.sequence)
        return re.split(r"[/ ]+", str(sequence).strip())

    @computed_field
    @cached_property
    def audio(self) -> str:
        return gtts(self.text)

    @cached_method
    def get_word_boundaries(self) -> list[tuple[str, int, int]]:
        boundaries = []
        index = 0
        text = Punctuation().remove(self.text)
        words = str(text).split()
        sequence = Punctuation().remove(self.sequence)
        phonemes = str(sequence).split()
        for word, phones in zip(words, phonemes):
            start = index
            index += len(phones.split("/"))
            boundaries.append((word, start, index))
        return boundaries


class TranscriptGenerator(Generator):
    # TODO: refine this prompt
    SYSTEM_PROMPT = """
    You are an expert language teacher specializing in pronunciation for English learners.
    Generate exactly one sentence with the following context for pronunciation practice.
    - Scenario: extracted from a casual conversation
    - Difficulty: suitable for intermediate learners
    Output only the sentence itself, with no additional text and no quotes.
    The sentence should be fresh and should not have been generated previously.
    """

    @property
    def system_prompt(self) -> str:
        return TranscriptGenerator.SYSTEM_PROMPT

    def __call__(self) -> Transcript:
        text = super().__call__(
            "",
            top_p=0.9,
            temperature=0.8,
            frequency_penalty=0.1,
        )
        text = text.strip().split("\n")[-1]  # safeguard to trim preamable if any
        return Transcript.from_text(text)
