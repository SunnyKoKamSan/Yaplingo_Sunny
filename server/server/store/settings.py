from pydantic import RedisDsn
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    url: RedisDsn

    model_config = SettingsConfigDict(env_prefix="store_")


settings = Settings.model_validate({})
