from functools import cached_property
from pathlib import Path
from typing import TYPE_CHECKING

from pydantic import computed_field
from pydantic.dataclasses import dataclass

from ..generators.transcript import Transcript
from ..textspeech import ktts
from . import Generator

if TYPE_CHECKING:
    from ..pipeline.aligner import Pronunciation


@dataclass(frozen=True, kw_only=True)
class Feedback:
    text: str

    @computed_field
    @cached_property
    def audio(self) -> str:
        return ktts(self.text)


class FeedbackGenerator(Generator):
    @property  # FIXME: use `@cached_property` in production
    def system_prompt(self) -> str:
        path = Path(__file__).parent / "prompts" / "feedback.md"
        return path.read_text(encoding="utf-8").strip()

    def __call__(self, transcript: Transcript, pronunciation: "Pronunciation") -> Feedback:
        differences = pronunciation.get_differences()
        errors = "\n".join([f"\t- {d}" for d in differences]) if differences else "None"
        prompt = f"""
        Now roast this attempt:
        Text: "{transcript.text}"
        Errors: \n{errors}
        """
        print(prompt)  # DEBUG
        print("/".join(transcript.phonemes))  # DEBUG
        print("/".join(pronunciation.phonemes))  # DEBUG
        text = super().__call__(prompt, temperature=0)
        print(text)  # DEBUG
        return Feedback(text=text.strip())
