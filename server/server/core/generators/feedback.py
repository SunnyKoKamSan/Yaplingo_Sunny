from functools import cached_property

from pydantic import computed_field
from pydantic.dataclasses import dataclass

from ..generators.transcript import Transcript
from ..pipeline.aligner import Pronunciation
from ..textspeech import ktts
from . import Generator


@dataclass(frozen=True, kw_only=True)
class Feedback:
    text: str

    @computed_field
    @cached_property
    def audio(self) -> str:
        return ktts(self.text)


class FeedbackGenerator(Generator):
    SYSTEM_PROMPT = """
    You are a friendly pronunciation coach specializing in English IPA phonemes.
    Your goal is to give concise, encouraging feedback based on the phoneme errors provided.
    Each error is formatted as: '[word]' \\t [operation] \\t [canonical] → [observed]
    where operation is one of: replace, insert, delete.
    Use Google's Pronunciation Respelling instead of IPA to represent phonemes in your feedback.
    """
    USER_PROMPT = """
    Analyze the following pronunciation attempt.
    Text: "{text}"
    Errors: \n{errors}
    """
    PERFECT_FEEDBACK = "Excellent pronunciation! You made no mistakes."

    @property
    def system_prompt(self) -> str:
        return FeedbackGenerator.SYSTEM_PROMPT

    def __call__(self, transcript: Transcript, pronunciation: Pronunciation) -> Feedback:
        differences = pronunciation.get_differences()
        if not differences:
            return Feedback(text=FeedbackGenerator.PERFECT_FEEDBACK)
        prompt = FeedbackGenerator.USER_PROMPT.format(
            text=transcript.text,
            errors="\n".join([f"\t- {d}" for d in differences]),
        )
        print(prompt)  # DEBUG
        print("/".join(transcript.phonemes))  # DEBUG
        print("/".join(pronunciation.phonemes))  # DEBUG
        text = super().__call__(prompt, temperature=0)
        return Feedback(text=text.strip())
