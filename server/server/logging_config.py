import logging
import os
import warnings


def _env_is_true(name: str) -> bool:
    return os.getenv(name, "").strip().lower() in {"1", "true", "yes", "on"}


def configure_runtime_logging() -> None:
    quiet_mode = _env_is_true("APP_QUIET_LOGS")
    if not quiet_mode:
        return

    logger_levels = {
        "httpx": logging.WARNING,
        "httpcore": logging.WARNING,
        "openai._base_client": logging.WARNING,
        "taskiq.receiver.receiver": logging.WARNING,
        "phonemizer": logging.ERROR,
    }
    for logger_name, level in logger_levels.items():
        logging.getLogger(logger_name).setLevel(level)

    warnings.filterwarnings(
        "ignore",
        message=r".*torchaudio\.load_with_torchcodec` under the hood.*",
        category=UserWarning,
    )
    warnings.filterwarnings(
        "ignore",
        message=r".*torchaudio\.functional\._alignment\.forced_align has been deprecated.*",
        category=UserWarning,
    )
