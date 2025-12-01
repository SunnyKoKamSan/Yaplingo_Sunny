# __version__ = "0.1.0"

from server.web import app

__all__ = ["app"]  # re-export for uvicorn
