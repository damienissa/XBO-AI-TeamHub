# backend/tests/test_services_mention_parser.py
# Pure unit tests for app.services.mention_parser.extract_mentioned_user_ids()

import json

from app.services.mention_parser import extract_mentioned_user_ids


def test_none_returns_empty():
    assert extract_mentioned_user_ids(None) == []


def test_plain_string_returns_empty():
    assert extract_mentioned_user_ids("hello world") == []


def test_json_string_parsed():
    doc = {
        "type": "doc",
        "content": [
            {"type": "mention", "attrs": {"id": "user-123"}},
        ],
    }
    assert extract_mentioned_user_ids(json.dumps(doc)) == ["user-123"]


def test_invalid_json_string():
    assert extract_mentioned_user_ids("{bad json") == []


def test_dict_with_mention():
    doc = {
        "type": "doc",
        "content": [
            {"type": "mention", "attrs": {"id": "abc"}},
        ],
    }
    assert extract_mentioned_user_ids(doc) == ["abc"]


def test_nested_mentions():
    doc = {
        "type": "doc",
        "content": [
            {
                "type": "paragraph",
                "content": [
                    {"type": "mention", "attrs": {"id": "user-1"}},
                    {"type": "text", "text": " and "},
                    {
                        "type": "paragraph",
                        "content": [
                            {"type": "mention", "attrs": {"id": "user-2"}},
                        ],
                    },
                ],
            },
        ],
    }
    result = extract_mentioned_user_ids(doc)
    assert result == ["user-1", "user-2"]


def test_duplicate_ids_deduped():
    doc = {
        "type": "doc",
        "content": [
            {"type": "mention", "attrs": {"id": "same-id"}},
            {"type": "mention", "attrs": {"id": "same-id"}},
        ],
    }
    assert extract_mentioned_user_ids(doc) == ["same-id"]


def test_empty_dict():
    assert extract_mentioned_user_ids({}) == []


def test_mention_without_attrs():
    doc = {
        "type": "doc",
        "content": [
            {"type": "mention"},
        ],
    }
    assert extract_mentioned_user_ids(doc) == []


def test_mention_with_empty_id():
    doc = {
        "type": "doc",
        "content": [
            {"type": "mention", "attrs": {"id": ""}},
        ],
    }
    assert extract_mentioned_user_ids(doc) == []


def test_non_dict_returns_empty():
    assert extract_mentioned_user_ids(42) == []
