def test_intelligence_overview_shape():
    from backend.intelligence.service import build_overview

    overview = build_overview()
    assert "health" in overview
    assert "score" in overview["health"]
    assert "recommendations" in overview
    assert "timeline" in overview
    assert "resources" in overview
    assert overview["health"]["score"] >= 0
    assert overview["health"]["score"] <= 100
