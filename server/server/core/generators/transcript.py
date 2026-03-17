import random
import re
import logging
from pathlib import Path

from ..models import Transcript, Transcripts
from . import BaseGenerator, LLMUnavailableError, reloadable_property

logger = logging.getLogger(__name__)


class TranscriptGenerator(BaseGenerator):
    TOPICS = ["Food", "Culture", "Travel", "Business", "Technology"]
    SENTENCE_COUNT = 5
    FALLBACK_SCENARIOS: dict[str, tuple[str, list[str]]] = {
        "Food": (
            "Ordering dinner at a popular local restaurant.",
            [
                "Hi, I'd like a table for two, please.",
                "Could I see the menu and the chef's specials?",
                "I'll have the grilled fish with steamed vegetables.",
                "Can we also get one sparkling water and one tea?",
                "Everything tastes great, thank you for the recommendation.",
            ],
        ),
        "Culture": (
            "Visiting a city museum with a friend.",
            [
                "This gallery highlights traditional clothing and music.",
                "I like how each exhibit explains the historical context.",
                "Let's join the guided tour starting in ten minutes.",
                "That painting shows daily life from a century ago.",
                "I learned a lot about local festivals today.",
            ],
        ),
        "Travel": (
            "Checking in at an airport before an international flight.",
            [
                "Good morning, I'm checking in for flight 218.",
                "Here is my passport and booking confirmation.",
                "Could I have an aisle seat if one is available?",
                "Do I need to collect my bag during transit?",
                "What time does boarding begin at the gate?",
            ],
        ),
        "Business": (
            "Presenting project updates in a team meeting.",
            [
                "Let's start with the key progress from this week.",
                "We completed the prototype and validated core requirements.",
                "The main risk is delivery time for one external dependency.",
                "I suggest we shift one engineer to unblock integration.",
                "If this plan works, we can launch the beta next month.",
            ],
        ),
        "Technology": (
            "Discussing an app release with the engineering team.",
            [
                "The new version improves startup speed and stability.",
                "We fixed the crash reported on older Android devices.",
                "Monitoring dashboards now include latency and error trends.",
                "Let's stage the rollout to ten percent of users first.",
                "If metrics remain healthy, we'll expand the release tomorrow.",
            ],
        ),
    }

    @reloadable_property
    def system_prompt(self) -> str:
        path = Path(__file__).parent / "prompts" / "transcript.md"
        return path.read_text(encoding="utf-8").strip()

    def _fallback_transcripts(self, topic: str) -> Transcripts:
        scenario, sentences = self.FALLBACK_SCENARIOS[topic]
        items = [Transcript(text=s) for s in sentences[: self.SENTENCE_COUNT]]
        return Transcripts(topic=topic, scenario=scenario, items=items)

    async def __call__(self) -> Transcripts:
        topic = random.choice(self.TOPICS)
        try:
            text = await super().call(
                f"Topic: {topic}",
                temperature=1.25,
                # frequency_penalty=2.0,
                # presence_penalty=2.0,
            )
        except LLMUnavailableError:
            logger.warning("Using fallback transcript content for topic '%s'.", topic)
            return self._fallback_transcripts(topic)

        lines = list(filter(bool, [s.strip() for s in text.splitlines()]))
        if len(lines) < self.SENTENCE_COUNT + 1:
            logger.warning("Invalid transcript model output. Using fallback content for topic '%s'.", topic)
            return self._fallback_transcripts(topic)
        scenario = re.split(r"^\s?[+]\s?", lines[0], maxsplit=1)[-1].strip()
        sentences = [
            re.split(r"^\s?[-–*]\s?", line, maxsplit=1)[-1].strip()
            for line in lines[1 : self.SENTENCE_COUNT + 1]
        ]
        if len(sentences) < self.SENTENCE_COUNT:
            logger.warning("Transcript sentence count mismatch. Using fallback content for topic '%s'.", topic)
            return self._fallback_transcripts(topic)
        items = [Transcript(text=s) for s in sentences]
        return Transcripts(topic=topic, scenario=scenario, items=items)
