import json
from pathlib import Path

from ..models.common import Insights
from . import BaseGenerator


class InsightsGenerator(BaseGenerator):
    SYSTEM_PROMPT_FILE_PATH = Path(__file__).parent / "prompts" / "user" / "insights.md"

    async def __call__(self, insights: Insights) -> str:
        prompt = json.dumps(insights.model_dump(mode="json"), indent=2)
        return (await super().call(prompt, temperature=0.3)).strip()


__all__ = ["Insights", "InsightsGenerator"]
