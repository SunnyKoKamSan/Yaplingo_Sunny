import asyncio
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
