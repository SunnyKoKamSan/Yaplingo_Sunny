import asyncio
import base64
import functools
import io
import time

import torchaudio


def data_urlencode(data: bytes, mime: str) -> str:
    encoded = base64.b64encode(data).decode()
    return f"data:{mime};base64,{encoded}"


def waveform_to_audio_b64(waveform, sr) -> bytes:
    buffer = io.BytesIO()
    torchaudio.save(buffer, waveform.unsqueeze(0), sr, format="wav")
    return base64.b64encode(buffer.getvalue())


def cached_method(f):
    attr = f"@{f.__name__}"

    @functools.wraps(f)
    def wrapper(self):
        if hasattr(self, attr):
            return object.__getattribute__(self, attr)
        object.__setattr__(self, attr, result := f(self))
        return result

    return wrapper


def log_execution_time(f):
    qualname = f.__qualname__
    if "." in qualname:
        [classname, fname] = qualname.split(".")
    else:
        [classname, fname] = ["", qualname]
    name = classname if fname == "__call__" else fname

    @functools.wraps(f)
    async def async_wrapper(*args, **kwargs):
        start = time.time()
        result = await f(*args, **kwargs)
        end = time.time()
        elapsed = end - start
        print(f"{name}: {elapsed:.4f} seconds")
        return result

    @functools.wraps(f)
    def wrapper(*args, **kwargs):
        start = time.time()
        result = f(*args, **kwargs)
        end = time.time()
        elapsed = end - start
        print(f"{name}: {elapsed:.4f} seconds")
        return result

    return async_wrapper if asyncio.iscoroutinefunction(f) else wrapper
