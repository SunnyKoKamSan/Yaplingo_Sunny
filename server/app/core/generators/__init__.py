from abc import ABC, abstractmethod

from openai import OpenAI


class Generator(ABC):
    MODEL_ID = "ai/llama3.1"

    BASE_URL = "http://model-runner.docker.internal/engines/v1"

    def __init__(self):
        self._client = OpenAI(base_url=Generator.BASE_URL, api_key="")

    @property
    @abstractmethod
    def system_prompt(self) -> str:
        raise NotImplementedError

    def __call__(self, prompt: str, **kwargs) -> str:
        completion = self._client.chat.completions.create(
            model=Generator.MODEL_ID,
            messages=[
                {"role": "system", "content": self.system_prompt},
                {"role": "user", "content": prompt},
            ],
            **kwargs,
        )
        return completion.choices[0].message.content or ""
