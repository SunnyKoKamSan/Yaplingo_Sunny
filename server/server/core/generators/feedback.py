import logging
from pathlib import Path

from ..models import Pronunciation, Transcript
from . import BaseGenerator, LLMUnavailableError, reloadable_property

logger = logging.getLogger(__name__)


class FeedbackGenerator(BaseGenerator):
    @reloadable_property
    def system_prompt(self) -> str:
        path = Path(__file__).parent / "prompts" / "feedback.md"
        return path.read_text(encoding="utf-8").strip()

    @staticmethod
    def _fallback_feedback(pronunciation: Pronunciation) -> str:
        if not pronunciation.differences:
            return "Great job! Your pronunciation sounds clear and natural. Keep the same pace and confidence."

        focus_words = list(dict.fromkeys([d.word for d in pronunciation.differences if d.word]))[:3]
        words_text = ", ".join(focus_words) if focus_words else "a few words"
        return (
            f"Nice effort. Focus on clearer pronunciation for {words_text}. "
            "Slow down slightly, stress key syllables, and repeat the sentence once more for consistency."
        )

    async def __call__(self, transcript: Transcript, pronunciation: Pronunciation) -> str:
        errors = "\n".join([f"\t- {d}" for d in pronunciation.differences]) if pronunciation.differences else "None"
        prompt = f"""
        Text: "{transcript.text}"
        Errors: \n{errors}
        """
        try:
            text = await super().call(prompt, temperature=0)
            clean = text.strip()
            if clean:
                return clean
            logger.debug("Empty LLM feedback output. Using fallback feedback text.")
        except LLMUnavailableError:
            logger.debug("LLM unavailable while generating feedback. Using fallback feedback text.")
        return self._fallback_feedback(pronunciation)
