import asyncio
from dataclasses import dataclass

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Response, status
from openai import APIConnectionError, APIStatusError, APITimeoutError, RateLimitError
from pydantic import Base64Bytes, BaseModel
from ulid import ULID

from server.core import Result, Transcripts
from server.core.generators import LLMTransientError, is_retryable_llm_error
from server.core.generators.transcript import TranscriptGenerationError
from server.dependencies import Store, Yaplingo, current_user


class Echo(BaseModel):
    audio: Base64Bytes


@dataclass(frozen=True, kw_only=True)
class TaskResult:
    pending: bool = True
    result: Result | Exception | None = None


RESULTS: dict[ULID, TaskResult] = {}

router = APIRouter(dependencies=[Depends(current_user)])


@router.get("/transcripts")
async def get_transcripts(yaplingo: Yaplingo, store: Store) -> Transcripts:
    try:
        transcripts = await yaplingo.generate_transcripts()
        await asyncio.gather(*[store.save_transcript(item) for item in transcripts.items])
        return transcripts
    except (LLMTransientError, TranscriptGenerationError) as error:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Transcript generation is temporarily unavailable. Please try again shortly.",
            headers={"Retry-After": "3"},
        ) from error
    except (APIConnectionError, APITimeoutError, RateLimitError, APIStatusError) as error:
        if not is_retryable_llm_error(error):
            raise
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Transcript generation is temporarily unavailable. Please try again shortly.",
            headers={"Retry-After": "3"},
        ) from error


@router.post("/{tid}", status_code=status.HTTP_201_CREATED)
async def post_transcript(
    tid: ULID,
    echo: Echo,
    yaplingo: Yaplingo,
    store: Store,
    background: BackgroundTasks,
) -> None:
    if (transcript := await store.get_transcript(tid)) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)

    async def analyze_audio():
        RESULTS[tid] = TaskResult()
        try:
            result = await yaplingo.analyze_audio(echo.audio, transcript)
        except Exception as e:
            result = e
        RESULTS[tid] = TaskResult(pending=False, result=result)

    background.add_task(analyze_audio)


@router.get("/{tid}/result")
async def get_transcript_result(tid: ULID, response: Response, store: Store) -> Result | None:
    if await store.get_transcript(tid) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
    if tid not in RESULTS or RESULTS[tid].pending:
        raise HTTPException(status_code=status.HTTP_425_TOO_EARLY)
    result = RESULTS[tid].result
    if isinstance(result, Exception):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Audio analysis is temporarily unavailable. Please retry this attempt.",
            headers={"Retry-After": "3"},
        ) from result
    if result is None:
        response.status_code = status.HTTP_204_NO_CONTENT
    return result
