from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import agents, alerts, briefs, companies, evidence, health, scans, traces
from app.db import init_db


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    init_db()
    yield


def create_app() -> FastAPI:
    app = FastAPI(title="Pulse Vendor Risk Agent API", version="0.1.0", lifespan=lifespan)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(health.router)
    app.include_router(companies.router)
    app.include_router(agents.router)
    app.include_router(scans.router)
    app.include_router(alerts.router)
    app.include_router(evidence.router)
    app.include_router(traces.router)
    app.include_router(briefs.router)

    return app


app = create_app()
