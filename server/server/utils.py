import functools


def cached_method(f):
    attr = f"@{f.__name__}"

    @functools.wraps(f)
    def wrapper(self):
        if hasattr(self, attr):
            return object.__getattribute__(self, attr)
        result = f(self)
        object.__setattr__(self, attr, result)
        return result

    return wrapper
