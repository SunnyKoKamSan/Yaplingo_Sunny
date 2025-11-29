import asyncio
import random
import re
from functools import cached_property
from pathlib import Path

from phonemizer import phonemize
from phonemizer.punctuation import Punctuation
from phonemizer.separator import Separator
from pydantic import Field
from pydantic.dataclasses import dataclass
from ulid import ULID

from ...utils import cached_method
from ..textspeech import gtts
from . import Generator

SEPARATOR = Separator(phone="/", word=" ")
PUNCTUATION = Punctuation()


@dataclass(frozen=True, kw_only=True)
class Transcript:
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
        audio = await gtts(text)
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


@dataclass(frozen=True, kw_only=True)
class Transcripts:
    topic: str
    scenario: str
    items: list[Transcript]


class TranscriptGenerator(Generator):
    TOPICS = ["food", "culture", "travel", "business", "technology"]

    @property  # FIXME: use `@cached_property` in production
    def system_prompt(self) -> str:
        path = Path(__file__).parent / "prompts" / "transcript.md"
        return path.read_text(encoding="utf-8").strip()

    async def __call__(self) -> Transcripts:
        topic = random.choice(self.TOPICS)
        text = await super().__call__(
            f"Topic: {topic}",
            temperature=1.25,
            # frequency_penalty=2.0,
            # presence_penalty=2.0,
        )
        print(f"{'=' * 10} TRANSCRIPTS {'=' * 10}\n@ {topic}\n{text}\n{'=' * 30}")  # DEBUG
        lines = list(filter(bool, [s.strip() for s in text.splitlines()]))
        if len(lines) < 6:
            return await self()  # FIXME: retry on invalid output
        scenario = re.split(r"^\s?[+]\s?", lines[0], maxsplit=1)[-1].strip()
        sentences = [re.split(r"^\s?[-–*]\s?", line, maxsplit=1)[-1].strip() for line in lines[1:]]
        items = await asyncio.gather(*[Transcript.from_text(s) for s in sentences])
        return Transcripts(topic=topic, scenario=scenario, items=items)
