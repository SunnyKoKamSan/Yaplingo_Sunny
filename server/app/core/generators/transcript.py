from dataclasses import dataclass

from phonemizer import phonemize
from ulid import ULID

from . import Generator


@dataclass
class Transcript:
    id: ULID
    text: str
    phonemes: list[str]


class TranscriptGenerator(Generator):
    LANGUAGE = "English"
    LANG_CODE = "en-us"
    SYSTEM_PROMPT = f"""
    You are an expert language teacher specializing in pronunciation for {LANGUAGE} learners.
    Generate exactly one sentence with the following context for pronunciation practice.

    - Scenario: extracted from a casual conversation
    - Difficulty: suitable for intermediate learners

    Output only the sentence itself, with no additional text and no quotes.
    The sentence should be fresh and should not have been generated previously.
    """

    @property
    def system_prompt(self) -> str:
        return TranscriptGenerator.SYSTEM_PROMPT

    def __call__(self) -> Transcript:
        text = super().__call__(
            "",
            top_p=0.9,
            temperature=0.8,
            frequency_penalty=0.1,
        )
        # TODO: use model's tokenizer to do phonemes conversion
        phonemes = phonemize(
            text,
            language=TranscriptGenerator.LANG_CODE,
            backend="espeak",
            strip=True,
            with_stress=False,
            preserve_punctuation=True,
        )
        return Transcript(id=ULID(), text=text, phonemes=str(phonemes).split())
