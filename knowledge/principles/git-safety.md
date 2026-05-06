# Git Safety Protocol

**When to use:** Before any git branch operation (checkout, create, rebase, reset). Referenced by mu-code and any skill that manipulates branches.

**Core principle:** Verify state before acting — don't assume which branch you're on or whether a branch already exists.

## Before Switching Branches

1. `git branch` — confirm current branch
2. `git status` — confirm working tree is clean (stash or commit if not)
3. If the target branch name came from memory (not the user's exact words), verify it exists: `git branch -a | grep <keyword>`

## Before Creating a Branch

1. **Search first** — `git branch -a | grep <keyword>` to check for existing branches with the same or similar name (watch for prefix variants: `feat/` vs `feature/`, `fix/` vs `bugfix/`)
2. **Confirm base** — state which branch you're branching from; don't assume `main`
3. **Follow naming convention** — check recent branches (`git branch --sort=-committerdate | head -5`) to match the project's prefix style

## Before Destructive Operations (rebase / reset / force-push)

1. **Confirm remote backup** — `git log --oneline origin/<branch> -1` to verify the branch is pushed
2. **Ask the user** — state the exact command and its effect before executing
3. **Verify after** — `git log --oneline -3` or `git diff origin/<branch>` to confirm the result matches intent

## Why This Matters

These checks exist because:
- Branch names from conversation context can be misremembered or ambiguous (e.g., `feature/session_pool` vs `feature/session_pool_allocation`)
- Destructive operations on the wrong branch can lose work that requires `git reflog` to recover
- Creating a duplicate branch wastes effort and creates confusion about which is canonical

The common root cause: **acting on assumptions instead of verified state.** A 5-second `git branch && git status` prevents a 15-minute recovery.
