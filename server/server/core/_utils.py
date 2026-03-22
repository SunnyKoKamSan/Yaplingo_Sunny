import functools
import time


def cached_method(f):
    attr = f"@{f.__name__}"

    @functools.wraps(f)
    def wrapper(self):
        if hasattr(self, attr):
            return object.__getattribute__(self, attr)
        object.__setattr__(self, attr, result := f(self))
        return result

    return wrapper


def timecall(name: str):
    def decorator(f):
        @functools.wraps(f)
        def wrapper(*args, **kwargs):
            start = time.perf_counter()
            result = f(*args, **kwargs)
            end = time.perf_counter()
            elapsed = end - start
            print(f"> {name}: {elapsed:.4f} seconds")
            return result

        return wrapper

    return decorator
