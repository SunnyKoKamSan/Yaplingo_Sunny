from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    secret: str


settings = Settings.model_validate({})
