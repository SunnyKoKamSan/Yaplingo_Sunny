FROM python:3.10
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

RUN apt-get update && \
    # phonemizer: uses espeak-ng as the backend
    apt-get install espeak-ng -y --no-install-recommends && \
    # deepfilternet: requires maturin to build
    apt-get install python3-maturin -y --no-install-recommends

WORKDIR /server

COPY pyproject.toml uv.lock .
COPY ./vendor ./vendor

RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --no-install-project && \
    # kokoro: requires pip to install some packages
    uv pip install pip

COPY ./server ./server

EXPOSE 8000
ENV PYTHONUNBUFFERED=1
CMD ["uv", "run", "uvicorn", "server.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
