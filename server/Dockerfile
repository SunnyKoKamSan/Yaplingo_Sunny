FROM python:3.13.7
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

RUN apt-get update && \
    # install espeak-ng for phonemizer to work
    apt-get install espeak-ng -y --no-install-recommends && \
    # install maturin to build deepfilternet
    apt-get install cargo -y --no-install-recommends && \
    uv tool install maturin

WORKDIR /app

COPY pyproject.toml uv.lock .

RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --no-install-project

COPY ./app ./app

EXPOSE 8000
ENV PYTHONUNBUFFERED=1
CMD ["uv", "run", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
