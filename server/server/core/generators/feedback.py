from pathlib import Path

from ..models import Pronunciation, Transcript
from . import BaseGenerator


class FeedbackGenerator(BaseGenerator):
    @property  # FIXME: use `@cached_property` in production
    def system_prompt(self) -> str:
        path = Path(__file__).parent / "prompts" / "feedback.md"
        return path.read_text(encoding="utf-8").strip()

    async def __call__(self, transcript: Transcript, pronunciation: Pronunciation) -> str:
        differences = pronunciation.get_differences()
        errors = "\n".join([f"\t- {d}" for d in differences]) if differences else "None"
        prompt = f"""
        Text: "{transcript.text}"
        Errors: \n{errors}
        """
        print(prompt)  # DEBUG
        print("/".join(transcript.phonemes))  # DEBUG
        print("/".join(pronunciation.phonemes))  # DEBUG
        text = await super().__call__(prompt, temperature=0)
        print(text)  # DEBUG
        return text.strip()
