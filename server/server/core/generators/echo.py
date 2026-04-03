import random
from pathlib import Path

from pydantic import ValidationError

from ..models.common import Pronunciation
from ..models.echo import Scenario, Transcript
from . import BaseGenerator


class ScenarioGenerator(BaseGenerator):
    SYSTEM_PROMPT_FILE_PATH = Path(__file__).parent / "prompts" / "echo" / "scenario.md"

    TOPICS = ["food", "culture", "travel", "business", "sports"]

    class Response(Scenario):
        transcripts: list[str]

    async def __call__(self) -> Scenario:
        topic = random.choice(self.TOPICS)
        response = await super().call(
            f"""
            Generate one new set.
            Topic: {topic}
            """,
            temperature=1.25,
            response_format={
                "type": "json_schema",
                "json_schema": ScenarioGenerator.Response.model_json_schema(),
            },
        )
        try:
            scenario = ScenarioGenerator.Response.model_validate_json(response)
            return Scenario(
                topic=scenario.topic,
                scenario=scenario.scenario,
                transcripts=[Transcript(text=s) for s in scenario.transcripts],
            )
        except ValidationError:
            return await self()


class FeedbackGenerator(BaseGenerator):
    SYSTEM_PROMPT_FILE_PATH = Path(__file__).parent / "prompts" / "echo" / "feedback.md"

    async def __call__(self, transcript: Transcript, pronunciation: Pronunciation) -> str:
        errors = "\n".join([f"\t- {d}" for d in pronunciation.differences]) if pronunciation.differences else "None"
        prompt = f"""
        Text: "{transcript.text}"
        Errors: \n{errors}
        """
        return (await super().call(prompt, temperature=0)).strip()
