# ============ Build Stage ============
FROM python:3.10 AS builder
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

RUN --mount=type=cache,target=/var/cache/apt,sharing=locked \
    --mount=type=cache,target=/var/lib/apt,sharing=locked \
    apt-get update && \
    # deepfilternet: requires maturin to build
    apt-get install -y --no-install-recommends python3-maturin

WORKDIR /server

COPY pyproject.toml uv.lock init.py .
COPY ./vendor ./vendor

RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --no-install-project && \
    # kokoro: requires pip to install voice packages
    uv pip install --no-cache-dir pip && \
    uv run python init.py


# ============ Runtime Stage ============
FROM python:3.10-slim
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

RUN --mount=type=cache,target=/var/cache/apt,sharing=locked \
    --mount=type=cache,target=/var/lib/apt,sharing=locked \
    apt-get update && \
    apt-get install -y --no-install-recommends libgomp1 git && \
    # phonemizer: uses espeak-ng as the backend
    apt-get install -y --no-install-recommends espeak-ng

WORKDIR /server

COPY --from=builder /server/.venv /server/.venv
COPY --from=builder /server/pyproject.toml /server/uv.lock ./
COPY ./vendor ./vendor
COPY ./server ./server

EXPOSE 8000
ENV PYTHONUNBUFFERED=1
CMD ["uv", "run", "uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
