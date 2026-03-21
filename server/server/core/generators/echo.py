import random
import re
from pathlib import Path

from ..models.echo import Pronunciation, Scenario, Transcript
from . import BaseGenerator


class ScenarioGenerator(BaseGenerator):
    SYSTEM_PROMPT_FILE_PATH = Path(__file__).parent / "prompts" / "echo" / "scenario.md"

    TOPICS = ["food", "culture", "travel", "business"]

    async def __call__(self) -> Scenario:
        topic = random.choice(self.TOPICS)
        text = await super().call(
            f"Topic: {topic}",
            temperature=1.25,
            # frequency_penalty=2.0,
            # presence_penalty=2.0,
        )
        lines = list(filter(bool, [s.strip() for s in text.splitlines()]))
        if len(lines) < 6:
            return await self()  # FIXME: prevent unlimited retry on invalid output
        scenario = re.split(r"^\s?[+]\s?", lines[0], maxsplit=1)[-1].strip()
        sentences = [re.split(r"^\s?[-–*]\s?", line, maxsplit=1)[-1].strip() for line in lines[1:]]
        items = [Transcript(text=s) for s in sentences]
        return Scenario(topic=topic, scenario=scenario, transcripts=items)


class FeedbackGenerator(BaseGenerator):
    SYSTEM_PROMPT_FILE_PATH = Path(__file__).parent / "prompts" / "echo" / "feedback.md"

    async def __call__(self, transcript: Transcript, pronunciation: Pronunciation) -> str:
        errors = "\n".join([f"\t- {d}" for d in pronunciation.differences]) if pronunciation.differences else "None"
        prompt = f"""
        Text: "{transcript.text}"
        Errors: \n{errors}
        """
        text = await super().call(prompt, temperature=0)
        return text.strip()
