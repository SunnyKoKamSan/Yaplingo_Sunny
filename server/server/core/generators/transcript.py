import re
from functools import cached_property
from pathlib import Path

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


@dataclass(frozen=True, kw_only=True)
class Transcripts:
    topic: str
    scenario: str
    items: list[Transcript]


class TranscriptGenerator(Generator):
    @property  # FIXME: use `@cached_property` in production
    def system_prompt(self) -> str:
        path = Path(__file__).parent / "prompts" / "transcript.md"
        return path.read_text(encoding="utf-8").strip()

    def __call__(self) -> Transcripts:
        text = super().__call__(
            "Now generate one new set following all rules and format exactly.",
            temperature=1.0,
            frequency_penalty=2.0,
            presence_penalty=2.0,
        )
        print("=" * 10)  # DEBUG
        print(text)  # DEBUG
        print("=" * 10)  # DEBUG
        lines = list(filter(bool, [s.strip() for s in text.splitlines()]))
        if len(lines) < 7:
            return self()  # FIXME: retry on invalid output
        topic = re.split(r"^\s?[@]\s?", lines[0], maxsplit=1)[-1].strip()
        scenario = re.split(r"^\s?[+]\s?", lines[1], maxsplit=1)[-1].strip()
        sentences = [re.split(r"^\s?[-–*]\s?", line, maxsplit=1)[-1].strip() for line in lines[2:]]
        items = [Transcript.from_text(s) for s in sentences]
        return Transcripts(topic=topic, scenario=scenario, items=items)
