---
name: github-repo
description: >
  Interact with the Personal OS GitHub repository (bautiarmanicode/personal-os).
  Use this skill whenever the user wants to read, write, update, or list files in the
  Personal OS repo — including QUEUE.md, REGISTRY.md, checkpoints, skills, crons, or any
  other file in Personal_OS_LAB/. Also use this when the user mentions GitHub repo operations,
  pushing files, reading repo content, or managing the Personal OS system. Even if the user
  doesn't explicitly say "GitHub", if they refer to repo files, the LAB, the Vault, QUEUE,
  checkpoints, or the Personal OS in general, invoke this skill.
---

# GitHub Repo — Personal OS

This skill provides read/write access to the Personal OS GitHub repository.

## Configuration

- **Repo**: `bautiarmanicode/personal-os` (branch `master`)
- **Tool**: Python3 script at `scripts/github_api.py`
- **Authentication**: GitHub PAT (stored in script, owner-provided)

## Available Operations

### 1. Read a file

Use Bash to execute the helper script:

```bash
python3 /home/z/my-project/skills/github-repo/scripts/github_api.py read "<path>"
```

Example — read QUEUE.md:
```bash
python3 /home/z/my-project/skills/github-repo/scripts/github_api.py read "Personal_OS_LAB/00_System/QUEUE.md"
```

### 2. Write/Create a file

```bash
python3 /home/z/my-project/skills/github-repo/scripts/github_api.py write "<path>" "<content>" "<commit message>"
```

Example — create a checkpoint:
```bash
python3 /home/z/my-project/skills/github-repo/scripts/github_api.py write "Personal_OS_LAB/00_System/sandboxes/state/mi-canal.md" "status: activa" "Sandbox activa en mi-canal"
```

**Important**: The content argument is a single string. For multi-line content, use a heredoc or escape properly.

For multi-line writes, prefer using Python directly:
```bash
python3 -c "
import sys
sys.path.insert(0, '/home/z/my-project/skills/github-repo/scripts')
from github_api import write_file
content = '''# My File
line 1
line 2
'''
write_file('Personal_OS_LAB/00_System/sandboxes/state/mi-canal.md', content, 'Create checkpoint')
print('Done')
"
```

### 3. Append to a file

```bash
python3 /home/z/my-project/skills/github-repo/scripts/github_api.py append "<path>" "<content>" "<commit message>"
```

Example — add a completed task to a log:
```bash
python3 /home/z/my-project/skills/github-repo/scripts/github_api.py append "Personal_OS_LAB/00_System/QUEUE.md" "- [x] Task completed" "Mark task as completed"
```

### 4. List a directory

```bash
python3 /home/z/my-project/skills/github-repo/scripts/github_api.py list "<path>"
```

Example — list sandboxes:
```bash
python3 /home/z/my-project/skills/github-repo/scripts/github_api.py list "Personal_OS_LAB/00_System/sandboxes/state"
```

### 5. Get file info (SHA, size)

```bash
python3 /home/z/my-project/skills/github-repo/scripts/github_api.py info "<path>"
```

## Common Paths Reference

| What | Path |
|------|------|
| QUEUE | `Personal_OS_LAB/00_System/QUEUE.md` |
| REGISTRY | `Personal_OS_LAB/00_System/sandboxes/REGISTRY.md` |
| CRON DEFINITIONS | `Personal_OS_LAB/00_System/CRON_DEFINITIONS.md` |
| Checkpoints | `Personal_OS_LAB/00_System/sandboxes/state/<channel>.md` |
| Skills | `Personal_OS_LAB/00_System/skills/` |
| CEO Roadmap | `Personal_OS_Vault/CEO_ROADMAP.md` |
| Results | `Personal_OS_LAB/results/` |

## Rules

- **NEVER touch `Personal_OS_Vault/`** unless explicitly told to by the owner (34U70).
- Always confirm with Bauti before executing tasks from QUEUE.md.
- Use descriptive commit messages.
- For complex multi-line edits, use the Python import method shown above.
