from pathlib import Path
from typing import TYPE_CHECKING

from pydantic.dataclasses import dataclass

from ..generators.transcript import Transcript
from . import Generator

if TYPE_CHECKING:
    from ..pipeline.aligner import Pronunciation


@dataclass(frozen=True, kw_only=True)
class Feedback:
    text: str
    audio: str

    @classmethod
    async def from_text(cls, text: str) -> "Feedback":
        # audio = await ktts(text)
        return cls(text=text, audio="")


class FeedbackGenerator(Generator):
    @property  # FIXME: use `@cached_property` in production
    def system_prompt(self) -> str:
        path = Path(__file__).parent / "prompts" / "feedback.md"
        return path.read_text(encoding="utf-8").strip()

    async def __call__(self, transcript: Transcript, pronunciation: "Pronunciation") -> Feedback:
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
        return await Feedback.from_text(text.strip())
