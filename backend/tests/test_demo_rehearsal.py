from app.services.demo_rehearsal import RehearsalConfig, run_demo_rehearsal


def test_disposable_replay_rehearsal_proves_demo_invariants() -> None:
    report = run_demo_rehearsal(
        RehearsalConfig(mode="replay", poll_interval_seconds=0, timeout_seconds=30)
    )

    assert report["mode"] == "replay"
    assert report["status"] == "completed"
    assert report["within_three_minutes"] is True
    assert report["evidence_count"] == 3
    assert report["verified_count"] == 3
    assert report["high_priority_alerts_checked"] >= 1
    assert report["related_change_present"] is True
    assert report["source_modes"] == {"cached": 4}
    assert report["brief_formats_checked"] == ["markdown", "html"]
