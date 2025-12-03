from pydantic import RedisDsn
from pydantic_settings import BaseSettings, SettingsConfigDict

from server.store.settings import settings as store_settings


class Settings(BaseSettings):
    url: RedisDsn = store_settings.url

    model_config = SettingsConfigDict(env_prefix="broker_")


settings = Settings()
