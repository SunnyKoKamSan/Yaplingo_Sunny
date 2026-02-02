from pathlib import Path

from ..models import Pronunciation, Transcript
from . import BaseGenerator, reloadable_property


class FeedbackGenerator(BaseGenerator):
    @reloadable_property
    def system_prompt(self) -> str:
        path = Path(__file__).parent / "prompts" / "feedback.md"
        return path.read_text(encoding="utf-8").strip()

    async def __call__(self, transcript: Transcript, pronunciation: Pronunciation) -> str:
        errors = "\n".join([f"\t- {d}" for d in pronunciation.differences]) if pronunciation.differences else "None"
        prompt = f"""
        Text: "{transcript.text}"
        Errors: \n{errors}
        """
        print(prompt)  # DEBUG
        print("/".join(transcript.phonemes))  # DEBUG
        print("/".join(pronunciation.phonemes))  # DEBUG
        text = await super().call(prompt, temperature=0)
        return text.strip()
