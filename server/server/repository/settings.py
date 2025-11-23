from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    url: str

    model_config = SettingsConfigDict(env_prefix="db_")


settings = Settings.model_validate({})
