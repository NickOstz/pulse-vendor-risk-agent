def test_health_reports_database_scheduler_and_replay(client):
    response = client.get("/api/health")

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["database"] is True
    assert body["scheduler"] is True
    assert body["replay_data"] is True
    assert body["brightdata_key_present"] is False
    assert body["llm_key_present"] is False
