#!/usr/bin/env python3
"""
GitHub Sync — Read, write, create, append, list, and delete files in a GitHub repository
via the GitHub Contents API (api.github.com/repos/{owner}/{repo}/contents/{path}).

Configuration (environment variables):
  GITHUB_SYNC_REPO    — Repository in owner/repo format (REQUIRED)
  GITHUB_SYNC_BRANCH  — Branch to operate on (default: main)
  GITHUB_SYNC_TOKEN   — GitHub Personal Access Token (REQUIRED)
"""

import urllib.request
import urllib.error
import json
import base64
import sys
import os


# ── Configuration ──────────────────────────────────────────────────────────────

REPO = os.environ.get("GITHUB_SYNC_REPO", "")
BRANCH = os.environ.get("GITHUB_SYNC_BRANCH", "main")
TOKEN = os.environ.get("GITHUB_SYNC_TOKEN", "")

BASE_URL = f"https://api.github.com/repos/{REPO}/contents"


# ── Helpers ────────────────────────────────────────────────────────────────────

def _validate_config():
    """Ensure required configuration is present."""
    if not REPO:
        print("ERROR: GITHUB_SYNC_REPO environment variable is not set.", file=sys.stderr)
        print("Example: export GITHUB_SYNC_REPO='owner/repo'", file=sys.stderr)
        sys.exit(1)
    if not TOKEN:
        print("ERROR: GITHUB_SYNC_TOKEN environment variable is not set.", file=sys.stderr)
        sys.exit(1)


def _headers():
    """Return HTTP headers for GitHub API requests."""
    return {
        "Authorization": f"Bearer {TOKEN}",
        "Accept": "application/vnd.github.v3+json",
        "User-Agent": "github-sync/1.0",
    }


def _api_error_message(e: urllib.error.HTTPError) -> str:
    """Extract a human-readable error message from a GitHub API HTTPError."""
    try:
        body = json.loads(e.read())
        message = body.get("message", str(e))
        if e.code == 409:
            return f"CONFLICT: {message} — Re-fetch the file SHA and retry."
        if e.code in (401, 403):
            return f"UNAUTHORIZED: {message} — Check your GITHUB_SYNC_TOKEN."
        if e.code == 404:
            return f"NOT FOUND: {message} — The path does not exist in the repo."
        return f"HTTP {e.code}: {message}"
    except Exception:
        return f"HTTP {e.code}: {e}"


# ── Core Operations ────────────────────────────────────────────────────────────

def read_file(path: str) -> str:
    """Read a file from the repo via GET /contents/{path}.

    Returns the decoded file content as a string.
    """
    url = f"{BASE_URL}/{path}?ref={BRANCH}"
    req = urllib.request.Request(url, headers=_headers())
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read())
            return base64.b64decode(data["content"]).decode("utf-8")
    except urllib.error.HTTPError as e:
        print(_api_error_message(e), file=sys.stderr)
        sys.exit(1)


def get_file_info(path: str) -> dict:
    """Get metadata for a file: SHA, path, size.

    The SHA is required when updating or deleting existing files.
    """
    url = f"{BASE_URL}/{path}?ref={BRANCH}"
    req = urllib.request.Request(url, headers=_headers())
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read())
            return {"sha": data["sha"], "path": data["path"], "size": data["size"]}
    except urllib.error.HTTPError as e:
        print(_api_error_message(e), file=sys.stderr)
        sys.exit(1)


def write_file(path: str, content: str, message: str = "Update file") -> dict:
    """Create or update a file via PUT /contents/{path}.

    For existing files, fetches the current SHA first to avoid conflicts.
    Each write automatically creates a commit on the configured branch.
    Returns the full API response including commit SHA.
    """
    # Try to get the current SHA (file might not exist yet)
    sha = None
    try:
        info = get_file_info(path)
        sha = info["sha"]
    except SystemExit:
        # 404 means the file doesn't exist — that's fine for creation
        pass

    payload = {
        "message": message,
        "content": base64.b64encode(content.encode("utf-8")).decode(),
        "branch": BRANCH,
    }
    if sha:
        payload["sha"] = sha

    body = json.dumps(payload).encode("utf-8")
    url = f"{BASE_URL}/{path}"
    req = urllib.request.Request(
        url,
        headers={**_headers(), "Content-Type": "application/json"},
        data=body,
        method="PUT",
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        print(_api_error_message(e), file=sys.stderr)
        sys.exit(1)


def append_to_file(path: str, new_content: str, message: str = "Append to file") -> dict:
    """Append content to an existing file.

    Reads the current file, appends the new content with proper newline handling,
    then commits via write_file.
    """
    existing = read_file(path)
    updated = existing.rstrip("\n") + "\n" + new_content + "\n"
    return write_file(path, updated, message)


def list_directory(path: str) -> list:
    """List files and directories at the given path.

    Returns a list of dicts with 'name', 'type', and 'path' keys.
    """
    url = f"{BASE_URL}/{path}?ref={BRANCH}"
    req = urllib.request.Request(url, headers=_headers())
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read())
            return [{"name": item["name"], "type": item["type"], "path": item["path"]} for item in data]
    except urllib.error.HTTPError as e:
        print(_api_error_message(e), file=sys.stderr)
        sys.exit(1)


def delete_file(path: str, message: str = "Delete file") -> dict:
    """Delete a file from the repo via DELETE /contents/{path}.

    Requires the file's current SHA. Returns the API response.
    """
    info = get_file_info(path)
    sha = info["sha"]

    payload = {
        "message": message,
        "sha": sha,
        "branch": BRANCH,
    }
    body = json.dumps(payload).encode("utf-8")
    url = f"{BASE_URL}/{path}"
    req = urllib.request.Request(
        url,
        headers={**_headers(), "Content-Type": "application/json"},
        data=body,
        method="DELETE",
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        print(_api_error_message(e), file=sys.stderr)
        sys.exit(1)


# ── CLI Interface ──────────────────────────────────────────────────────────────

if __name__ == "__main__":
    _validate_config()

    if len(sys.argv) < 2:
        print("Usage: python github_sync.py <command> [args...]", file=sys.stderr)
        print("Commands:", file=sys.stderr)
        print("  read <path>                          Read a file", file=sys.stderr)
        print("  write <path> <content> [message]     Create/update a file", file=sys.stderr)
        print("  append <path> <content> [message]    Append to a file", file=sys.stderr)
        print("  list <path>                          List directory contents", file=sys.stderr)
        print("  info <path>                          Get file metadata (SHA, size)", file=sys.stderr)
        print("  delete <path> [message]              Delete a file", file=sys.stderr)
        print("", file=sys.stderr)
        print(f"Configured repo: {REPO} (branch: {BRANCH})", file=sys.stderr)
        sys.exit(1)

    cmd = sys.argv[1]

    if cmd == "read" and len(sys.argv) >= 3:
        print(read_file(sys.argv[2]))

    elif cmd == "write" and len(sys.argv) >= 4:
        path = sys.argv[2]
        content = sys.argv[3]
        message = sys.argv[4] if len(sys.argv) >= 5 else "Update file"
        result = write_file(path, content, message)
        commit_sha = result.get("commit", {}).get("sha", "unknown")[:7]
        print(f"OK: committed {commit_sha}")

    elif cmd == "append" and len(sys.argv) >= 4:
        path = sys.argv[2]
        content = sys.argv[3]
        message = sys.argv[4] if len(sys.argv) >= 5 else "Append to file"
        result = append_to_file(path, content, message)
        commit_sha = result.get("commit", {}).get("sha", "unknown")[:7]
        print(f"OK: committed {commit_sha}")

    elif cmd == "list" and len(sys.argv) >= 3:
        items = list_directory(sys.argv[2])
        for item in items:
            icon = "[DIR]" if item["type"] == "dir" else "[FILE]"
            print(f"{icon} {item['name']}")

    elif cmd == "info" and len(sys.argv) >= 3:
        info = get_file_info(sys.argv[2])
        print(f"SHA: {info['sha'][:12]}... | Size: {info['size']} bytes | Path: {info['path']}")

    elif cmd == "delete" and len(sys.argv) >= 3:
        path = sys.argv[2]
        message = sys.argv[3] if len(sys.argv) >= 4 else "Delete file"
        result = delete_file(path, message)
        commit_sha = result.get("commit", {}).get("sha", "unknown")[:7]
        print(f"OK: deleted and committed {commit_sha}")

    else:
        print(f"Unknown command or missing arguments: {cmd}", file=sys.stderr)
        sys.exit(1)
