import base64

from taskiq import Context, TaskiqDepends

from server.core.models import ChatResult, EchoResult
from server.models import ChatSessionState, EchoSessionState

from . import broker


@broker.task
async def analyze_echo(
    audio_b64: str,
    session: EchoSessionState,
    context: Context = TaskiqDepends(),
) -> EchoResult | None:
    audio = base64.b64decode(audio_b64)
    return await context.state.echo(audio, session.transcript)


@broker.task
async def process_chat(
    audio_b64: str,
    session: ChatSessionState,
    context: Context = TaskiqDepends(),
) -> ChatResult | None:
    audio = base64.b64decode(audio_b64)
    return await context.state.chat(audio, session.scenario, session.conversation)


__all__ = ["analyze_echo", "process_chat"]
