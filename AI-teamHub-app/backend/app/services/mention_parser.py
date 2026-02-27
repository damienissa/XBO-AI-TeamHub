import json
from typing import Any


def extract_mentioned_user_ids(content: Any) -> list[str]:
    """Recursively walk a TipTap JSON doc, return user ID strings from mention nodes.

    Handles:
    - dict  — TipTap doc object
    - str   — tries JSON.parse first; falls back to treating as plain text (no mentions)
    - None  — returns []
    """
    if content is None:
        return []

    if isinstance(content, str):
        try:
            content = json.loads(content)
        except (json.JSONDecodeError, ValueError):
            return []

    if not isinstance(content, dict):
        return []

    ids: list[str] = []
    _walk(content, ids)
    return ids


def _walk(node: dict, ids: list[str]) -> None:
    if node.get("type") == "mention":
        attrs = node.get("attrs") or {}
        uid = attrs.get("id")
        if uid and uid not in ids:
            ids.append(uid)

    for child in node.get("content") or []:
        if isinstance(child, dict):
            _walk(child, ids)
