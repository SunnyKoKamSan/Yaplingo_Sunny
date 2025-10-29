from pydantic_settings import BaseSettings, SettingsConfigDict


class RepositorySettings(BaseSettings):
    url: str = "sqlite://"  # defaults to in-memory SQLite database

    model_config = SettingsConfigDict(env_prefix="db_")


settings = RepositorySettings.model_validate({})
