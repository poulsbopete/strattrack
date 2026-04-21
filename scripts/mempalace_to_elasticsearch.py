#!/usr/bin/env python3
"""
One-time import: read Chroma-backed drawers from a legacy MemPalace palace directory
into StratTrack Elasticsearch (strattrack_drawers). Use this when replacing MemPalace
with StratTrack, not as an ongoing dual-write path.

Requires: pip install -r scripts/requirements-mempalace-migrate.txt
           Local Elasticsearch running (./scripts/build-elastic-docker.sh)
           Optional: ./scripts/init-strattrack-index.sh (or let --ensure-index create it)

Read-only on the source Chroma directory (no deletes).
"""
from __future__ import annotations

import argparse
import json
import os
import ssl
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path


def _repo_root() -> Path:
    return Path(__file__).resolve().parent.parent


def _load_index_body() -> dict:
    p = _repo_root() / "docker" / "strattrack-drawers-index.json"
    if not p.is_file():
        sys.exit(f"Missing index definition: {p}")
    return json.loads(p.read_text(encoding="utf-8"))


def _es_headers(es_api_key: str | None, es_basic: str | None) -> dict[str, str]:
    h = {"Content-Type": "application/json", "Accept": "application/json"}
    if es_api_key:
        h["Authorization"] = f"ApiKey {es_api_key}"
    elif es_basic:
        h["Authorization"] = f"Basic {es_basic}"
    return h


def _es_request(
    base_url: str,
    method: str,
    path: str,
    *,
    body: bytes | None = None,
    headers: dict[str, str],
    timeout: int = 300,
) -> tuple[int, dict | str]:
    url = base_url.rstrip("/") + path
    req = urllib.request.Request(url, data=body, method=method, headers=headers)
    ctx = ssl.create_default_context()
    try:
        with urllib.request.urlopen(req, context=ctx, timeout=timeout) as resp:
            raw = resp.read().decode("utf-8", errors="replace")
            code = resp.getcode() or 200
            if not raw:
                return code, {}
            try:
                return code, json.loads(raw)
            except json.JSONDecodeError:
                return code, raw
    except urllib.error.HTTPError as e:
        err_body = e.read().decode("utf-8", errors="replace")
        try:
            parsed = json.loads(err_body)
        except json.JSONDecodeError:
            parsed = err_body
        raise RuntimeError(f"Elasticsearch HTTP {e.code} {method} {path}: {parsed}") from e


def _ensure_index(base_url: str, index: str, headers: dict[str, str]) -> None:
    code, _ = _es_request(base_url, "HEAD", f"/{index}", headers=headers, body=None)
    if code == 200:
        print(f"Index {index!r} already exists.", file=sys.stderr)
        return
    body = json.dumps(_load_index_body()).encode("utf-8")
    code, data = _es_request(base_url, "PUT", f"/{index}", body=body, headers=headers)
    if code not in (200, 201):
        sys.exit(f"Failed to create index: {data}")
    print(f"Created index {index!r}.", file=sys.stderr)


def _meta_scalar(value) -> str:
    if value is None:
        return ""
    if isinstance(value, (str, int, float, bool)):
        return str(value)
    try:
        return json.dumps(value, ensure_ascii=False)
    except TypeError:
        return str(value)


def _open_chroma_collection(palace_path: str, collection_name: str):
    try:
        import chromadb
    except ImportError as e:
        sys.exit(
            "chromadb is required. Install:\n"
            "  pip install -r scripts/requirements-mempalace-migrate.txt\n"
            f"Original error: {e}"
        )
    db = Path(palace_path) / "chroma.sqlite3"
    if not db.is_file():
        sys.exit(f"No Chroma data at {palace_path!r} (missing chroma.sqlite3).")
    client = chromadb.PersistentClient(path=palace_path)
    try:
        return client.get_collection(collection_name)
    except Exception as e:
        sys.exit(f"Could not open Chroma collection {collection_name!r}: {e}")


def _iter_drawers(coll, batch_size: int):
    """Yield (drawer_id, document, metadata dict) from Chroma in stable offset order."""
    total = coll.count()
    offset = 0
    while offset < total:
        batch = coll.get(
            include=["documents", "metadatas"],
            limit=batch_size,
            offset=offset,
        )
        ids = batch.get("ids") or []
        docs = batch.get("documents") or []
        metas = batch.get("metadatas") or []
        if not ids:
            break
        for i, did in enumerate(ids):
            doc = docs[i] if i < len(docs) else ""
            meta = metas[i] if i < len(metas) and metas[i] else {}
            yield did, doc or "", dict(meta) if isinstance(meta, dict) else {}
        offset += len(ids)


def _build_es_doc(drawer_id: str, content: str, meta: dict, now_iso: str) -> dict:
    title = (
        meta.get("title")
        or meta.get("drawer_title")
        or meta.get("name")
        or ""
    )
    if not isinstance(title, str):
        title = _meta_scalar(title)
    return {
        "content": content,
        "title": title,
        "wing": _meta_scalar(meta.get("wing")),
        "room": _meta_scalar(meta.get("room")),
        "mempalace_drawer_id": drawer_id,
        "source": "strattrack_chroma_import",
        "created_at": _meta_scalar(meta.get("created_at") or meta.get("timestamp"))
        or now_iso,
        "note_date": _meta_scalar(meta.get("note_date") or meta.get("timestamp"))
        or now_iso,
    }


def _bulk_post(
    base_url: str,
    ndjson: str,
    headers: dict[str, str],
) -> dict:
    bulk_headers = {**headers, "Content-Type": "application/x-ndjson"}
    body = ndjson.encode("utf-8")
    return _es_request(
        base_url,
        "POST",
        "/_bulk?refresh=wait_for",
        body=body,
        headers=bulk_headers,
        timeout=600,
    )[1]


def main() -> int:
    parser = argparse.ArgumentParser(
        description="One-time import of Chroma drawers (legacy MemPalace) into StratTrack Elasticsearch."
    )
    parser.add_argument(
        "--palace",
        default=os.environ.get("MEMPALACE_PALACE_PATH", os.path.expanduser("~/.mempalace/palace")),
        help="Directory containing chroma.sqlite3 (default ~/.mempalace/palace or MEMPALACE_PALACE_PATH).",
    )
    parser.add_argument(
        "--collection",
        default=os.environ.get("MEMPALACE_COLLECTION", "mempalace_drawers"),
        help="Chroma collection name (default mempalace_drawers or MEMPALACE_COLLECTION).",
    )
    parser.add_argument(
        "--es-url",
        default=os.environ.get("ELASTICSEARCH_URL", "http://localhost:9200"),
        help="Elasticsearch base URL.",
    )
    parser.add_argument(
        "--index",
        default=os.environ.get("STRATTRACK_INDEX", "strattrack_drawers"),
        help="Target Elasticsearch index.",
    )
    parser.add_argument(
        "--batch-size",
        type=int,
        default=200,
        help="Chroma read batch size (drawers per Chroma get).",
    )
    parser.add_argument(
        "--bulk-docs",
        type=int,
        default=100,
        help="Documents per Elasticsearch _bulk request (max 100 matches MCP tool).",
    )
    parser.add_argument(
        "--ensure-index",
        action="store_true",
        help="Create index from docker/strattrack-drawers-index.json if missing.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Only print drawer count from Chroma; do not write to Elasticsearch.",
    )
    args = parser.parse_args()

    es_key = os.environ.get("ELASTICSEARCH_API_KEY")
    es_basic = os.environ.get("ELASTICSEARCH_BASIC_AUTH")
    headers = _es_headers(es_key, es_basic)
    base = args.es_url.rstrip("/")
    now_iso = datetime.now(timezone.utc).isoformat()

    coll = _open_chroma_collection(args.palace, args.collection)
    total = coll.count()
    print(f"Chroma directory: {args.palace}", file=sys.stderr)
    print(f"Chroma collection: {args.collection!r}, drawers: {total}", file=sys.stderr)

    if args.dry_run:
        print(json.dumps({"dry_run": True, "drawer_count": total}, indent=2))
        return 0

    if args.ensure_index:
        _ensure_index(base, args.index, headers)

    # Fail fast if index missing
    try:
        _es_request(base, "HEAD", f"/{args.index}", headers=headers)
    except RuntimeError as e:
        sys.exit(
            f"{e}\nCreate the index first: ./scripts/init-strattrack-index.sh\n"
            "Or re-run with --ensure-index."
        )

    indexed = 0
    errors = 0
    buf_lines: list[str] = []
    bulk_n = max(1, min(args.bulk_docs, 500))

    def flush_bulk() -> None:
        nonlocal buf_lines, indexed, errors
        if not buf_lines:
            return
        ndjson = "\n".join(buf_lines) + "\n"
        buf_lines = []
        res = _bulk_post(base, ndjson, headers)
        if not isinstance(res, dict):
            raise RuntimeError(f"Unexpected bulk response: {res!r}")
        if res.get("errors"):
            errors += 1
            print(json.dumps(res, indent=2)[:4000], file=sys.stderr)
        items = res.get("items") or []
        for it in items:
            op = it.get("index") or it.get("create") or {}
            st = op.get("status", 0)
            if st >= 400:
                errors += 1
                print("Bulk item error:", json.dumps(op)[:500], file=sys.stderr)
        indexed += len(items)
        print(f"  Indexed {indexed} / ~{total} …", file=sys.stderr)

    for drawer_id, content, meta in _iter_drawers(coll, args.batch_size):
        doc = _build_es_doc(drawer_id, content, meta, now_iso)
        buf_lines.append(json.dumps({"index": {"_index": args.index, "_id": drawer_id}}))
        buf_lines.append(json.dumps(doc, ensure_ascii=False))
        if len(buf_lines) // 2 >= bulk_n:
            flush_bulk()

    flush_bulk()

    print(
        json.dumps(
            {
                "ok": errors == 0,
                "index": args.index,
                "elasticsearch": base,
                "drawers_seen": total,
                "bulk_operations": indexed,
                "bulk_batches_with_errors": errors,
            },
            indent=2,
        )
    )
    return 1 if errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
