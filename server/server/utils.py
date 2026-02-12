import functools
from datetime import datetime, timezone


def cached_method(f):
    attr = f"@{f.__name__}"

    @functools.wraps(f)
    def wrapper(self):
        if hasattr(self, attr):
            return object.__getattribute__(self, attr)
        object.__setattr__(self, attr, result := f(self))
        return result

    return wrapper


def get_current_utc_period_key() -> str:
    """
    Get the current ISO week period key based on UTC time.
    
    This ensures all users globally see the same "current week" leaderboard
    regardless of their local timezone.
    
    Returns:
        Period key in format "WEEK-YYYY-WW" (e.g., "WEEK-2026-05")
        
    Example:
        >>> # Called on 2026-01-29 (Thursday of week 5)
        >>> get_current_utc_period_key()
        'WEEK-2026-05'
    """
    now_utc = datetime.now(timezone.utc)
    year, week, _ = now_utc.isocalendar()
    return f"WEEK-{year}-{week:02d}"
