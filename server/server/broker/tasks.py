import base64

from taskiq import Context, TaskiqDepends

from server.core import Result, Transcript
from server.core.textspeech import data_urlencode

from . import broker


@broker.task
async def synthesize_tts(
    text: str,
    context: Context = TaskiqDepends(),
) -> str:
    audio = await context.state.ktts(text)
    return data_urlencode(audio, context.state.ktts.MIME)


@broker.task
async def analyze_echo(
    audio_b64: str,
    transcript: Transcript,
    context: Context = TaskiqDepends(),
) -> Result | None:
    audio = base64.b64decode(audio_b64)
    return await context.state.pipeline(audio, transcript)


__all__ = ["synthesize_tts", "analyze_echo"]
