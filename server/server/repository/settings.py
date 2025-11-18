from pydantic_settings import BaseSettings, SettingsConfigDict


class RepositorySettings(BaseSettings):
    url: str = "sqlite://"

    model_config = SettingsConfigDict(env_prefix="db_")


settings = RepositorySettings.model_validate({})
