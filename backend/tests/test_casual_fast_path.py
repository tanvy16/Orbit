from backend.ai.casual import try_casual_response


def test_casual_hello_is_instant():
    result = try_casual_response("Hello")
    assert result is not None
    assert result["directAnswer"] is True
    assert "Hello" in result["reply"]


def test_casual_unknown_long_message_skipped():
    assert try_casual_response("Hello, can you analyze my CPU usage and memory today?") is None
