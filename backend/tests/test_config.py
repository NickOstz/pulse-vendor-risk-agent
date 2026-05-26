from app.config import Settings


def test_blank_live_snapshot_dir_uses_ignored_default() -> None:
    settings = Settings(_env_file=None, brightdata_live_snapshot_dir="")

    assert settings.brightdata_live_snapshot_dir is None
    assert settings.live_snapshot_dir.parts[-2:] == ("snapshots", "live")


def test_allowed_origins_are_normalized_for_hosted_frontend() -> None:
    settings = Settings(
        _env_file=None,
        cors_allowed_origins="https://pulse.example, http://localhost:3000, ",
    )

    assert settings.allowed_origins == ["https://pulse.example", "http://localhost:3000"]
