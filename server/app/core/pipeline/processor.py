import io

import df as deepfilter
import torch
import torchaudio


class AudioProcessor:
    SR = 16_000  # 16kHz for Wav2Vec2

    def __init__(self):
        self._df_model, self._df_state, _ = deepfilter.init_df()

    def __call__(self, data: bytes) -> torch.Tensor | None:
        waveform, sr = torchaudio.load(io.BytesIO(data))
        # remove background noise
        if sr == self._df_state.sr():  # 48kHz for DeepFilter
            waveform = deepfilter.enhance(self._df_model, self._df_state, waveform)
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
