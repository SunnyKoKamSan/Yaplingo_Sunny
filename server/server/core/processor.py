import io

import df
import torch
import torchaudio


class AudioProcessor:
    def __init__(self, sr: int):
        self.sr = sr

        self.df_model, self.df_state, _ = df.init_df()

    def __call__(self, data: bytes) -> torch.Tensor | None:
        waveform, sr = torchaudio.load(io.BytesIO(data))
        # remove background noise (48kHz for DeepFilterNet)
        if sr == self.df_state.sr():
            waveform = df.enhance(self.df_model, self.df_state, waveform)
        # resample if necessary
        if sr != self.sr:
            waveform = torchaudio.functional.resample(waveform, sr, self.sr)
        # ensure waveform is mono
        if waveform.shape[0] > 1:
            waveform = waveform.mean(dim=0, keepdim=True)
        # trim silence in both ends
        waveform = torchaudio.functional.vad(waveform, self.sr)

        waveform = waveform.squeeze()  # flatten to 1D tensor
        if waveform.numel() == 0:
            return None  # silence only
        return waveform
