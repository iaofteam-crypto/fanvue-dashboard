---
name: github-sync
description: >
  Read, create, edit, and sync files in a GitHub repository via the GitHub Contents API.
  Use this skill whenever you need to read files from a GitHub repo, create or update files
  in a GitHub repo, list directory contents, append content to existing files, or push commits.
  This includes any mention of "github sync", "repo files", "read from repo", "write to repo",
  "push to github", "update file in repo", "create file in repo", or "commit to repo".
  Always use this skill when the task involves interacting with GitHub repository contents through
  the API, even if the user doesn't explicitly say "GitHub" but refers to syncing, pushing, or
  managing files in a remote repository.
---

# GitHub Sync

Interact with a GitHub repository using the GitHub Contents API (`api.github.com/repos/{owner}/{repo}/contents/{path}`).
This skill enables reading, writing, creating, and managing files directly through the API — each write operation automatically creates a commit and pushes to the configured branch.

## Configuration

The script reads configuration from environment variables. Set these in the agent's environment or pass them at invocation time.

| Variable | Description | Example |
|----------|-------------|---------|
| `GITHUB_SYNC_REPO` | Repository in `owner/repo` format | `bautiarmanicode/ia-of-team-3` |
| `GITHUB_SYNC_BRANCH` | Branch to operate on (default: `main`) | `main` |
| `GITHUB_SYNC_TOKEN` | GitHub Personal Access Token | `ghp_xxxxxxxxxxxx` |

If `GITHUB_SYNC_REPO` is not set, the script will fail with a clear error message — this is intentional to avoid writing to the wrong repository.

## Script Location

```
/home/z/my-project/skills/github-sync/scripts/github_sync.py
```

## Available Operations

### 1. Read a file (GET contents)

Fetch the current content of a file from the repo.

```bash
python3 /home/z/my-project/skills/github-sync/scripts/github_sync.py read "<path>"
```

**How it works**: Sends `GET /repos/{owner}/{repo}/contents/{path}?ref={branch}` to the GitHub API, then base64-decodes the response content.

**Example**:
```bash
python3 /home/z/my-project/skills/github-sync/scripts/github_sync.py read "README.md"
```

### 2. Write/Create a file (PUT contents)

Create a new file or update an existing one. Each write automatically creates a commit and pushes to the configured branch.

```bash
python3 /home/z/my-project/skills/github-sync/scripts/github_sync.py write "<path>" "<content>" "<commit message>"
```

**How it works**: For existing files, first fetches the current SHA via a GET request, then sends `PUT /repos/{owner}/{repo}/contents/{path}` with the base64-encoded content, the SHA, commit message, and branch. For new files, the SHA is omitted.

**Example**:
```bash
python3 /home/z/my-project/skills/github-sync/scripts/github_sync.py write "config/settings.json" '{"theme": "dark"}' "Update settings with dark theme"
```

**Multi-line content**: For content with newlines, use the Python import method:

```bash
python3 -c "
import sys
sys.path.insert(0, '/home/z/my-project/skills/github-sync/scripts')
from github_sync import write_file
content = '''# My Document
This is line one.
This is line two.
'''
write_file('docs/my-doc.md', content, 'Create documentation file')
print('Done')
"
```

### 3. Append to a file

Read the existing content, append new content at the end, and commit the result.

```bash
python3 /home/z/my-project/skills/github-sync/scripts/github_sync.py append "<path>" "<content>" "<commit message>"
```

**How it works**: Internally reads the file, concatenates the new content, then calls the write operation.

**Example**:
```bash
python3 /home/z/my-project/skills/github-sync/scripts/github_sync.py append "CHANGELOG.md" "- Added feature X" "Update changelog"
```

### 4. List a directory

List all files and directories at a given path.

```bash
python3 /home/z/my-project/skills/github-sync/scripts/github_sync.py list "<path>"
```

**How it works**: Sends `GET /repos/{owner}/{repo}/contents/{path}?ref={branch}` and returns an array of items with name, type, and path.

**Example**:
```bash
python3 /home/z/my-project/skills/github-sync/scripts/github_sync.py list "src/components"
```

### 5. Get file info

Retrieve metadata for a file: SHA, size, and path.

```bash
python3 /home/z/my-project/skills/github-sync/scripts/github_sync.py info "<path>"
```

### 6. Delete a file

Remove a file from the repository. Requires the file's current SHA.

```bash
python3 /home/z/my-project/skills/github-sync/scripts/github_sync.py delete "<path>" "<commit message>"
```

**How it works**: Fetches the current SHA, then sends `DELETE /repos/{owner}/{repo}/contents/{path}` with the SHA, commit message, and branch.

## Important Notes

- **Authentication**: A valid GitHub PAT with `repo` scope is required. The token is read from `GITHUB_SYNC_TOKEN`.
- **Commit messages**: Always use descriptive, meaningful commit messages. They become part of the repository history.
- **Branch**: Operations target the branch specified by `GITHUB_SYNC_BRANCH` (defaults to `main`).
- **File size limit**: The GitHub Contents API supports files up to 1 MB. For larger files, use the Git Blob API or Git Data API instead.
- **Rate limiting**: Unauthenticated requests are limited to 60/hour; authenticated requests to 5000/hour. The PAT handles authentication.
- **Conflict handling**: If a file was modified between the GET (to fetch SHA) and PUT, GitHub rejects the write with a 409 Conflict. Re-fetch the SHA and retry.
- **Binary files**: The script handles base64 encoding/decoding automatically. Text content is encoded as UTF-8.

## Error Handling

The script provides clear error messages:
- `REPO_NOT_CONFIGURED`: `GITHUB_SYNC_REPO` environment variable is not set.
- `TOKEN_NOT_CONFIGURED`: `GITHUB_SYNC_TOKEN` environment variable is not set.
- `FILE_NOT_FOUND` (404): The requested file or directory does not exist at the given path.
- `CONFLICT` (409): File was modified externally. Re-fetch and retry.
- `UNAUTHORIZED` (401/403): Token is invalid, expired, or lacks permissions.
