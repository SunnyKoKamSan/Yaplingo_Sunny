import base64

from fastapi import APIRouter, Depends, HTTPException, status
from ulid import ULID

from server.core import Transcript
from server.dependencies import Yaplingo, current_user
from server.schemas import TeachAudio, TeachResponse

TRANSCRIPTS: dict[ULID, Transcript] = {}  # TODO: use Redis for storing temporary data

router = APIRouter(dependencies=[Depends(current_user)])


@router.get("/")
async def generate(yaplingo: Yaplingo) -> Transcript:
    transcript = yaplingo.generate_transcript()
    TRANSCRIPTS[transcript.id] = transcript
    return transcript


@router.get("/{tid}")
async def get(tid: ULID) -> Transcript:
    transcript = TRANSCRIPTS.get(tid)
    if transcript is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
    return transcript


@router.post("/{tid}")
async def teach(
    tid: ULID,
    audio: TeachAudio,
    yaplingo: Yaplingo,
) -> TeachResponse | None:
    transcript = TRANSCRIPTS.get(tid)
    if transcript is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
    result = yaplingo.analyze(audio.audio, transcript)
    if result is None:
        return None
    tts = yaplingo.get_text_to_speech(result.feedback)
    return TeachResponse(
        feedback=TeachResponse.Feedback(
            text=result.feedback,
            audio=base64.b64encode(tts),
        ),
        phonemes=result.phonemes,
    )
