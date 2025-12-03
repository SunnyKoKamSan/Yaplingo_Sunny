import base64
from typing import Annotated

from taskiq import Context, TaskiqDepends

from server.core import Result, Transcript

from . import broker


@broker.task
async def analyze_echo(
    audio_b64: str,
    transcript: Transcript,
    context: Annotated[Context, TaskiqDepends()],
) -> Result | None:
    audio = base64.b64decode(audio_b64)
    return await context.state.pipeline(audio, transcript)


__all__ = ["analyze_echo"]
