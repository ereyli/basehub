#!/usr/bin/env python3
"""
Broadcast Base App notifications to opted-in users.

Supports one or many app URLs:
- BASE_APP_NOTIFICATIONS_APP_URL=https://www.basehub.fun
- BASE_APP_NOTIFICATIONS_APP_URLS=https://www.basehub.fun,https://basehub.fun,https://basehub-alpha.vercel.app

When multiple URLs are provided, users are fetched for each URL, then globally de-duplicated
(same wallet receives once only, based on first URL order).

Env:
  BASE_DASHBOARD_API_KEY            required
  BASE_APP_NOTIFICATIONS_APP_URL    optional single URL fallback
  BASE_APP_NOTIFICATIONS_APP_URLS   optional CSV URL list (priority order)
  NOTIFY_TITLE                      optional (<=30)
  NOTIFY_MESSAGE                    optional (<=200)
  NOTIFY_TARGET_PATH                optional default '/'
  DRY_RUN=1                         optional list only, no send

Docs: https://docs.base.org/apps/technical-guides/base-notifications
"""
from __future__ import annotations

import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from typing import Dict, List, Optional

API_BASE = "https://dashboard.base.org/api/v1"
UA = "BaseHub-notifications/1.1 (+https://www.basehub.fun)"

DEFAULT_TITLE = "BaseHub update"
DEFAULT_MESSAGE = "Most used feature lately: Deploy"


def clean_env_value(raw: str) -> str:
    s = (raw or "").strip()
    if len(s) >= 2 and s[0] == s[-1] and s[0] in ("'", '"'):
        s = s[1:-1].strip()
    return s


def api_headers(api_key: str) -> Dict[str, str]:
    return {
        "x-api-key": api_key,
        "User-Agent": UA,
        "Accept": "application/json",
    }


def env_required(key: str) -> str:
    v = clean_env_value(os.environ.get(key, ""))
    if not v:
        print(f"Missing env: {key}", file=sys.stderr)
        sys.exit(1)
    return v


def get_app_urls() -> List[str]:
    raw_list = clean_env_value(os.environ.get("BASE_APP_NOTIFICATIONS_APP_URLS", ""))
    if raw_list:
        urls = [clean_env_value(x) for x in raw_list.split(",")]
        urls = [u for u in urls if u]
    else:
        single = clean_env_value(os.environ.get("BASE_APP_NOTIFICATIONS_APP_URL", ""))
        urls = [single or "https://www.basehub.fun"]

    # Preserve order, remove exact duplicates
    out: List[str] = []
    seen = set()
    for u in urls:
        if u not in seen:
            seen.add(u)
            out.append(u)
    return out


def fetch_all_addresses(api_key: str, app_url: str) -> List[str]:
    addresses: List[str] = []
    cursor: Optional[str] = None
    enc_app = urllib.parse.quote(app_url, safe="")

    while True:
        qs = f"app_url={enc_app}&notification_enabled=true&limit=100"
        if cursor:
            qs += "&cursor=" + urllib.parse.quote(cursor, safe="")

        req = urllib.request.Request(
            f"{API_BASE}/notifications/app/users?{qs}",
            headers=api_headers(api_key),
            method="GET",
        )
        try:
            with urllib.request.urlopen(req, timeout=60) as resp:
                data = json.loads(resp.read().decode())
        except urllib.error.HTTPError as e:
            err = e.read().decode("utf-8", errors="replace")
            print(f"HTTP {e.code} on GET users ({app_url}): {err}", file=sys.stderr)
            sys.exit(2)

        if not data.get("success"):
            print(json.dumps(data, indent=2), file=sys.stderr)
            sys.exit(2)

        for u in data.get("users") or []:
            if isinstance(u, dict) and u.get("address"):
                addresses.append(str(u["address"]))

        raw_next = data.get("nextCursor")
        cursor = (raw_next or "").strip() or None
        if not cursor:
            break

    return addresses


def post_send(
    api_key: str,
    app_url: str,
    wallets: List[str],
    title: str,
    message: str,
    target_path: str,
) -> Dict:
    body = json.dumps(
        {
            "app_url": app_url,
            "wallet_addresses": wallets,
            "title": title,
            "message": message,
            "target_path": target_path,
        }
    ).encode("utf-8")

    h = api_headers(api_key)
    h["Content-Type"] = "application/json"
    req = urllib.request.Request(
        f"{API_BASE}/notifications/send",
        data=body,
        headers=h,
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=120) as resp:
        return json.loads(resp.read().decode())


def chunked(items: List[str], size: int) -> List[List[str]]:
    return [items[i : i + size] for i in range(0, len(items), size)]


def main() -> None:
    api_key = env_required("BASE_DASHBOARD_API_KEY")
    app_urls = get_app_urls()

    dry = os.environ.get("DRY_RUN", "").lower() in ("1", "true", "yes")
    title = clean_env_value(os.environ.get("NOTIFY_TITLE", DEFAULT_TITLE)) or DEFAULT_TITLE
    message = clean_env_value(os.environ.get("NOTIFY_MESSAGE", DEFAULT_MESSAGE)) or DEFAULT_MESSAGE
    target_path = clean_env_value(os.environ.get("NOTIFY_TARGET_PATH", "/")) or "/"

    if len(title) > 30:
        print(f"NOTIFY_TITLE must be <= 30 chars (got {len(title)})", file=sys.stderr)
        sys.exit(1)
    if len(message) > 200:
        print(f"NOTIFY_MESSAGE must be <= 200 chars (got {len(message)})", file=sys.stderr)
        sys.exit(1)

    print("Using app URLs (priority order):")
    for u in app_urls:
        print(f" - {u}")

    # url -> unique addresses for that URL
    fetched_by_url: Dict[str, List[str]] = {}
    for u in app_urls:
        print(f"Fetching opted-in users for {u}…")
        raw = fetch_all_addresses(api_key, u)
        dedup_local: Dict[str, str] = {}
        for a in raw:
            dedup_local.setdefault(a.lower(), a)
        fetched_by_url[u] = list(dedup_local.values())
        print(f"  found: {len(raw)} (unique local: {len(fetched_by_url[u])})")

    # Global dedupe by first URL priority
    assigned_by_url: Dict[str, List[str]] = {u: [] for u in app_urls}
    seen_global = set()
    for u in app_urls:
        for a in fetched_by_url[u]:
            k = a.lower()
            if k in seen_global:
                continue
            seen_global.add(k)
            assigned_by_url[u].append(a)

    total_unique = sum(len(v) for v in assigned_by_url.values())
    print(f"Total unique wallets across all URLs: {total_unique}")
    for u in app_urls:
        print(f"  send list for {u}: {len(assigned_by_url[u])}")

    if dry:
        print("DRY_RUN=1 — not sending.")
        return

    chunk_size = 1000
    for u in app_urls:
        wallets = assigned_by_url[u]
        if not wallets:
            continue

        print(f"Sending for app_url={u}")
        batches = chunked(wallets, chunk_size)
        for idx, chunk in enumerate(batches, start=1):
            print(f"  batch {idx}/{len(batches)} ({len(chunk)} wallets)…")
            try:
                out = post_send(api_key, u, chunk, title, message, target_path)
            except urllib.error.HTTPError as e:
                err_body = e.read().decode("utf-8", errors="replace")
                print(f"HTTP {e.code}: {err_body}", file=sys.stderr)
                sys.exit(3)

            print(json.dumps(out, indent=2))
            if not out.get("success"):
                print("Batch reported success=false — stopping.", file=sys.stderr)
                sys.exit(4)

            # Notification endpoints share 10 req/min/IP, pause between batches
            if idx < len(batches):
                time.sleep(7)

    print("Done.")


if __name__ == "__main__":
    main()
