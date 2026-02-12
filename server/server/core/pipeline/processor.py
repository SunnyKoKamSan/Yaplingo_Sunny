import io
import threading

import df
import torch
import torchaudio


class AudioProcessor:
    SR = 16_000  # 16kHz for Wav2Vec2

    def __init__(self, use_df: bool = True):
        self._use_df = use_df
        if use_df:
            self._df_model, self._df_state, _ = df.init_df()
            self._df_lock = threading.Lock()

    def __call__(self, data: bytes) -> torch.Tensor | None:
        waveform, sr = torchaudio.load(io.BytesIO(data))
        # remove background noise (48kHz for DeepFilterNet)
        if self._use_df and sr == self._df_state.sr():
            with self._df_lock:
                waveform = df.enhance(self._df_model, self._df_state, waveform)
        # resample if necessary
        if sr != AudioProcessor.SR:
            waveform = torchaudio.functional.resample(waveform, sr, AudioProcessor.SR)
        # ensure waveform is mono
        if waveform.shape[0] > 1:
            waveform = waveform.mean(dim=0, keepdim=True)
        # trim silence in both ends
        waveform_before_vad = waveform
        waveform = torchaudio.functional.vad(waveform, AudioProcessor.SR)

        waveform = waveform.squeeze()  # flatten to 1D tensor
        if waveform.numel() == 0:
            # If VAD trims everything, fall back to original waveform
            waveform_fallback = waveform_before_vad.squeeze()
            if waveform_fallback.numel() == 0:
                return None  # silence only
            return waveform_fallback
        return waveform
