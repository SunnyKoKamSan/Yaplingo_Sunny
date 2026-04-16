import random
from pathlib import Path

from pydantic import ValidationError

from .._utils import log_execution_time
from ..models.common import Insights, Pronunciation
from ..models.echo import Scenario, Transcript
from . import BaseGenerator


class ScenarioGenerator(BaseGenerator):
    SYSTEM_PROMPT_FILE_PATH = Path(__file__).parent / "prompts" / "echo" / "scenario.md"

    TOPICS = ["food", "culture", "travel", "business", "sports"]

    class Response(Scenario):
        transcripts: list[str]

    @log_execution_time
    async def __call__(self, insights: Insights | None = None) -> Scenario:
        topic = random.choice(self.TOPICS)
        prompt = f"""
        Generate one new set.
        Topic: {topic}
        """
        if insights is not None:
            prompt += f"""
        PRONUNCIATION INSIGHTS (from the learner's recent practice): \n{insights.format()}
        Use these insights to craft sentences that naturally include some of these challenging words or sounds, while staying relevant to the topic.
        """
        print(f"--- Scenario Generator ---\n{prompt}\n" + "-" * 25)
        response = await super().call(
            prompt,
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
            return await self(insights=insights)


class FeedbackGenerator(BaseGenerator):
    SYSTEM_PROMPT_FILE_PATH = Path(__file__).parent / "prompts" / "echo" / "feedback.md"

    @log_execution_time
    async def __call__(self, transcript: Transcript, pronunciation: Pronunciation) -> str:
        errors = "\n".join([f"\t- {d}" for d in pronunciation.differences]) if pronunciation.differences else "None"
        prompt = f"""
        Text: "{transcript.text}"
        Errors: \n{errors}
        """
        print(f"--- Feedback Generator ---\n{prompt}\n" + "-" * 25)
        return (await super().call(prompt, temperature=0)).strip()
