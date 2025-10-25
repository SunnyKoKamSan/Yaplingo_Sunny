from ..generators.transcript import Transcript
from ..pipeline.aligner import Alignment, Phonemes
from . import Generator

SCORE_THRESHOLD = 0.5


class FeedbackGenerator(Generator):
    LANGUAGE = "English"
    SYSTEM_PROMPT = f"""
    You are an expert language teacher specializing in giving feedback on pronunciation to {LANGUAGE} learners.
    Provide constructive feedback based on the given text and phonemes, focusing on pronunciation accuracy.
    The feedback should be concise and clear. The feedback should also be friendly and simple with no technical terms. Exclude grammatical details.
    Please refer to the learner as "you". Output only the feedback itself, with no additional text and no quotes. Keep the feedback short and concise.
    """
    USER_PROMPT = """
    Text: {text}
    Phonemes with low scores:
    {misprons}
    """

    @property
    def system_prompt(self) -> str:
        return FeedbackGenerator.SYSTEM_PROMPT

    def extract_mispronunciations(
        self, transcript: Transcript, phonemes: Phonemes
    ) -> dict[tuple[str, str], list[Alignment]] | None:
        misses = [(i, a) for i, a in enumerate(phonemes.alignments) if a.score < SCORE_THRESHOLD]
        if not misses:
            return None
        word_misses: dict[tuple[str, str], list[Alignment]] = {}
        for i, a in misses:
            index = 0
            for word, phones in transcript.word_phonemes:
                if i >= index and i < index + len(phones):
                    prons = "".join(phones)
                    word_misses.setdefault((word, prons), []).append(a)
                index += len(phones)
        return word_misses

    def __call__(self, transcript: Transcript, phonemes: Phonemes) -> str | None:
        misprons = self.extract_mispronunciations(transcript, phonemes)
        if not misprons:
            return None
        return super().__call__(
            FeedbackGenerator.USER_PROMPT.format(
                text=transcript.text,
                misprons="\n".join(
                    f"- {prons} ({word}): {' , '.join([m.token for m in misses])}"
                    for (word, prons), misses in misprons.items()
                ),
            )
        )
