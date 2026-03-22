import logging
import os
import warnings


def _env_is_true(name: str) -> bool:
    return os.getenv(name, "").strip().lower() in {"1", "true", "yes", "on"}


def configure_runtime_logging() -> None:
    logger_levels = {
        "uvicorn.access": logging.WARNING,
        "httpx": logging.WARNING,
        "httpcore": logging.WARNING,
        "openai": logging.WARNING,
        "openai._base_client": logging.WARNING,
        "phonemizer": logging.ERROR,
    }
    if _env_is_true("APP_QUIET_LOGS"):
        logger_levels.update({
            "openai._base_client": logging.WARNING,
            "taskiq.receiver.receiver": logging.WARNING,
        })

    for logger_name, level in logger_levels.items():
        logging.getLogger(logger_name).setLevel(level)

    warnings.filterwarnings(
        "ignore",
        message=r".*torchaudio\.functional\._alignment\.forced_align has been deprecated.*",
        category=UserWarning,
    )
    if _env_is_true("APP_QUIET_LOGS"):
        warnings.filterwarnings(
            "ignore",
            message=r".*torchaudio\.load_with_torchcodec` under the hood.*",
            category=UserWarning,
        )
