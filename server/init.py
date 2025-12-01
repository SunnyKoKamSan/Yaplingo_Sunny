from df import init_df
from kokoro import KPipeline
from transformers import Wav2Vec2ForCTC, Wav2Vec2PhonemeCTCTokenizer

if __name__ == "__main__":
    init_df()

    KPipeline(
        repo_id="hexgrad/Kokoro-82M",
        lang_code="en-us",
    )("yaplingo", voice="af_heart")

    MODEL_ID = "facebook/wav2vec2-lv-60-espeak-cv-ft"
    Wav2Vec2ForCTC.from_pretrained(MODEL_ID)
    Wav2Vec2PhonemeCTCTokenizer.from_pretrained(MODEL_ID)
