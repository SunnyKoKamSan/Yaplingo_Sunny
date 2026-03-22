from pathlib import Path

from pydantic import ValidationError

from .._utils import timecall
from ..models.chat import Conversation, Evaluation, Scenario
from . import BaseGenerator, settings


class ScenarioGenerator(BaseGenerator):
    SYSTEM_PROMPT_FILE_PATH = Path(__file__).parent / "prompts" / "chat" / "scenario.md"

    async def __call__(self) -> Scenario:
        text = await super().call(
            "Generate a new scenario.",
            temperature=1.25,
            response_format={
                "type": "json_schema",
                "json_schema": Scenario.model_json_schema(),
            },
        )
        try:
            return Scenario.model_validate_json(text)
        except ValidationError:
            return await self()


class ReplyGenerator(BaseGenerator):
    SYSTEM_PROMPT_FILE_PATH = Path(__file__).parent / "prompts" / "chat" / "reply.md"

    @timecall(name="ReplyGenerator")
    async def __call__(self, scenario: Scenario, conversation: Conversation) -> str:
        tasks = "\n".join(f"- {t}" for t in scenario.tasks)
        prompt = f"""
        Scenario: {scenario.scenario}
        Tasks: \n{tasks}

        Your Character: {scenario.characters[0]}
        Learner's Character: {scenario.characters[1]}

        Continue the conversation with a new reply from your character.
        """
        completion = await self.client.chat.completions.create(
            model=settings.model_id,
            messages=[
                {"role": "system", "content": self.system_prompt},
                {"role": "system", "content": prompt},
                *[
                    {
                        "role": m.role,
                        "content": m.content if m.role == "assistant" else m.transcript.text,
                    }
                    for m in conversation.messages
                ],  # type: ignore
            ],
        )
        return (completion.choices[0].message.content or "").strip()


class EvaluationGenerator(BaseGenerator):
    SYSTEM_PROMPT_FILE_PATH = Path(__file__).parent / "prompts" / "chat" / "evaluation.md"

    @timecall(name="EvaluationGenerator")
    async def __call__(self, scenario: Scenario, conversation: Conversation) -> Evaluation:
        tasks = "\n".join(f"- {t}" for t in scenario.tasks)
        messages = []
        for m in conversation.messages:
            messages.append(f": {m.content}" if m.role == "assistant" else f"< {m.transcript.text}")
        history = "\n".join(messages)
        prompt = f"""
        Tasks: \n{tasks}
        Conversation: \n{history}
        """
        text = await super().call(
            prompt,
            temperature=0,
            response_format={
                "type": "json_schema",
                "json_schema": Evaluation.model_json_schema(),
            },
        )
        try:
            return Evaluation.model_validate_json(text)
        except ValidationError:
            return await self(scenario, conversation)


__all__ = ["ScenarioGenerator", "ReplyGenerator", "EvaluationGenerator"]
