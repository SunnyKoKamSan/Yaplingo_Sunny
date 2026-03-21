import base64

from taskiq import Context, TaskiqDepends

from server.core.models import EchoResult
from server.models import EchoSessionState

from . import broker


@broker.task
async def analyze_echo(
    audio_b64: str,
    session: EchoSessionState,
    context: Context = TaskiqDepends(),
) -> EchoResult | None:
    audio = base64.b64decode(audio_b64)
    return await context.state.echo(audio, session.transcript)


__all__ = ["analyze_echo"]
