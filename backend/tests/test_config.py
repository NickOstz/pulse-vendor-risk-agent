from app.config import Settings


def test_blank_live_snapshot_dir_uses_ignored_default() -> None:
    settings = Settings(_env_file=None, brightdata_live_snapshot_dir="")

    assert settings.brightdata_live_snapshot_dir is None
    assert settings.live_snapshot_dir.parts[-2:] == ("snapshots", "live")
