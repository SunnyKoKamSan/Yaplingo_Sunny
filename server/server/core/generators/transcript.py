import asyncio
import random
import re
from pathlib import Path

from ..models import Transcript, Transcripts
from . import BaseGenerator


class TranscriptGenerator(BaseGenerator):
    TOPICS = ["food", "culture", "travel", "business", "technology"]

    @property  # FIXME: use `@cached_property` in production
    def system_prompt(self) -> str:
        path = Path(__file__).parent / "prompts" / "transcript.md"
        return path.read_text(encoding="utf-8").strip()

    async def __call__(self) -> Transcripts:
        topic = random.choice(self.TOPICS)
        text = await super().call(
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
