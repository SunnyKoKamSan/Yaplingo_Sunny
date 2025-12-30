from pydantic import PostgresDsn
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    url: PostgresDsn

    model_config = SettingsConfigDict(env_prefix="database_")


settings = Settings.model_validate({})
