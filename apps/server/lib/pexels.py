"""Pexels Video API client.

Thin async wrapper around https://api.pexels.com/videos/search
used to find B-roll clips for detected moments.
"""

from __future__ import annotations

import logging
import os

import httpx

logger = logging.getLogger(__name__)

_BASE_URL = "https://api.pexels.com/videos/search"


async def search_videos(query: str, per_page: int = 5) -> list[dict]:
    """Search Pexels for stock video clips.

    Returns a list of dicts, each containing:
        clip_id, clip_url (best mp4 <= 1080p), thumbnail_url, duration
    """
    api_key = os.environ.get("PEXELS_API_KEY", "")
    if not api_key:
        logger.warning("[pexels] PEXELS_API_KEY not set — skipping search")
        return []

    headers = {"Authorization": api_key}
    params = {"query": query, "per_page": per_page, "orientation": "landscape"}

    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.get(_BASE_URL, headers=headers, params=params)
        resp.raise_for_status()
        data = resp.json()

    results: list[dict] = []
    for video in data.get("videos", []):
        best_file = _pick_best_file(video.get("video_files", []))
        if not best_file:
            continue
        results.append({
            "clip_id": video["id"],
            "clip_url": best_file["link"],
            "thumbnail_url": video.get("image", ""),
            "duration": video.get("duration", 0),
        })

    return results


def _pick_best_file(video_files: list[dict]) -> dict | None:
    """Pick the best mp4 file with height <= 1080."""
    candidates = [
        f for f in video_files
        if f.get("file_type") == "video/mp4"
        and (f.get("height") or 0) <= 1080
        and f.get("link")
    ]
    if not candidates:
        # Fallback: any mp4
        candidates = [
            f for f in video_files
            if f.get("file_type") == "video/mp4" and f.get("link")
        ]
    if not candidates:
        return None
    # Prefer highest resolution <= 1080p
    candidates.sort(key=lambda f: f.get("height") or 0, reverse=True)
    return candidates[0]
