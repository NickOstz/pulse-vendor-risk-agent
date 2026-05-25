from collections.abc import Generator

from sqlmodel import Session, SQLModel, create_engine, select

from app.config import get_settings
from app.models import Company
from app.services.replay_loader import seed_companies


def _connect_args(database_url: str) -> dict[str, bool]:
    if database_url.startswith("sqlite"):
        return {"check_same_thread": False}
    return {}


engine = create_engine(
    get_settings().database_url,
    connect_args=_connect_args(get_settings().database_url),
)


def create_db_and_tables() -> None:
    SQLModel.metadata.create_all(engine)


def seed_database() -> None:
    with Session(engine) as session:
        has_companies = session.exec(select(Company.id).limit(1)).first()
        if has_companies is None:
            seed_companies(session)


def init_db() -> None:
    create_db_and_tables()
    seed_database()


def get_session() -> Generator[Session, None, None]:
    with Session(engine) as session:
        yield session
