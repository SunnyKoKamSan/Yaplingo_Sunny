from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    secret: str

    # Mastery score formula weights (must sum to 1.0)
    MASTERY_WEIGHT_XP: float = 0.5
    MASTERY_WEIGHT_ACC: float = 0.3
    MASTERY_WEIGHT_SPD: float = 0.2

    # Normalisation ceilings
    MASTERY_XP_CEILING: int = 5000
    MASTERY_SPEED_CEILING: int = 120000  # ms (2 min)

    # Tier thresholds (mastery_score 0.0-1.0)
    MASTERY_TIER_SILVER: float = 0.30
    MASTERY_TIER_GOLD: float = 0.55
    MASTERY_TIER_PLATINUM: float = 0.75
    MASTERY_TIER_DIAMOND: float = 0.90


settings = Settings.model_validate({})
