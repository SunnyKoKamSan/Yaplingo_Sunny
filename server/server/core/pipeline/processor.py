import io

import df
import torch
import torchaudio


class AudioProcessor:
    SR = 16_000  # 16kHz for Wav2Vec2

    def __init__(self, use_df: bool = True):
        self._use_df = use_df
        if use_df:
            self._df_model, self._df_state, _ = df.init_df()

    def __call__(self, data: bytes) -> torch.Tensor | None:
        waveform, sr = torchaudio.load(io.BytesIO(data))
        # remove background noise (48kHz for DeepFilterNet)
        if self._use_df and sr == self._df_state.sr():
            waveform = df.enhance(self._df_model, self._df_state, waveform)
        # resample if necessary
        if sr != AudioProcessor.SR:
            waveform = torchaudio.functional.resample(waveform, sr, AudioProcessor.SR)
        # ensure waveform is mono
        if waveform.shape[0] > 1:
            waveform = waveform.mean(dim=0, keepdim=True)
        # trim silence in both ends
        waveform = torchaudio.functional.vad(waveform, AudioProcessor.SR)

        waveform = waveform.squeeze()  # flatten to 1D tensor
        if waveform.numel() == 0:
            return None  # silence only
        return waveform
