from df import init_df
from faster_whisper import WhisperModel
from transformers import Wav2Vec2ForCTC, Wav2Vec2PhonemeCTCTokenizer


def init_wav2vec2():
    MODEL_ID = "facebook/wav2vec2-lv-60-espeak-cv-ft"
    Wav2Vec2ForCTC.from_pretrained(MODEL_ID)
    Wav2Vec2PhonemeCTCTokenizer.from_pretrained(MODEL_ID)


def init_whisper():
    MODEL_ID = "distil-small.en"
    WhisperModel(MODEL_ID, compute_type="int8")


if __name__ == "__main__":
    init_df()
    init_wav2vec2()
    init_whisper()
