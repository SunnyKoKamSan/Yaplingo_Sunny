from pydantic import SecretStr
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    secret: SecretStr
    deepgram_api_key: SecretStr


settings = Settings.model_validate({})
