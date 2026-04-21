from pathlib import Path

from pydantic import ValidationError

from .._utils import log_execution_time
from ..models.chat import Conversation, Evaluation, Scenario
from . import BaseGenerator, settings


class ScenarioGenerator(BaseGenerator):
    SYSTEM_PROMPT_FILE_PATH = Path(__file__).parent / "prompts" / "chat" / "scenario.md"

    @log_execution_time
    async def __call__(self) -> Scenario:
        response = await super().call(
            "Generate a new scenario.",
            temperature=0.8,
            response_format={
                "type": "json_schema",
                "json_schema": Scenario.model_json_schema(),
            },
        )
        try:
            return Scenario.model_validate_json(response)
        except ValidationError:
            return await self()


class ReplyGenerator(BaseGenerator):
    SYSTEM_PROMPT_FILE_PATH = Path(__file__).parent / "prompts" / "chat" / "reply.md"

    @log_execution_time
    async def __call__(self, scenario: Scenario, conversation: Conversation) -> str:
        tasks = "\n".join(f"- {t}" for t in scenario.tasks)
        prompt = f"""
        Scenario: {scenario.scenario}
        Tasks: \n{tasks}

        Continue the conversation with a new reply from your character.
        """
        completion = await self.client.chat.completions.create(
            model=settings.model_id,
            messages=[
                {"role": "system", "content": self.system_prompt},
                {
                    "role": "user",
                    "content": prompt,
                },  # conversation role needs to alternate between user and assistant; next is assistant's opening
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

    @log_execution_time
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
        print(f"--- Evaluation Generator ---\n{prompt}\n" + "-" * 25)
        response = await super().call(
            prompt,
            temperature=0,
            response_format={
                "type": "json_schema",
                "json_schema": Evaluation.model_json_schema(),
            },
        )
        try:
            return Evaluation.model_validate_json(response)
        except ValidationError:
            return await self(scenario, conversation)


__all__ = ["ScenarioGenerator", "ReplyGenerator", "EvaluationGenerator"]
