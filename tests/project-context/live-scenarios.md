# Project Context Integration Scenarios

These checks separate the deterministic decision contract from the current
host and GitHub binding. Run them from the repository root. The named scenario
commands use fake provider inputs and never mutate GitHub.

## Deterministic suite

Run the complete contract first:

```bash
npm run test:project-context
```

Expected: the Node test runner reports no failures. The suite includes the
external-delivery transition: merged code with pending human or platform work
stays `MergedPendingDelivery`, and only verified external work reaches
`Complete`.

Each focused command exits zero and prints `PASS: project-context scenario
<name>`:

```bash
npm run test:project-context -- --scenario github-write
npm run test:project-context -- --scenario github-read-only
npm run test:project-context -- --scenario no-github
npm run test:project-context -- --scenario declined-publication
npm run test:project-context -- --scenario ambiguous-issue
npm run test:project-context -- --scenario cross-worktree-resume
npm run test:project-context -- --scenario concurrent-human-edit
npm run test:project-context -- --scenario indeterminate-create
npm run test:project-context -- --scenario secret-rejection
npm run test:project-context -- --scenario multiple-required-prs
```

| Scenario | Contract proved |
|---|---|
| `github-write` | A fresh exact-operation grant permits a GitHub write; an explicit open Issue is reused instead of duplicated. |
| `github-read-only` | Read-only capability records fallback and blocks mutation. |
| `no-github` | A non-GitHub or unavailable provider selects manual or local fallback. |
| `declined-publication` | GitHub-first preference does not replace explicit creation authority. |
| `ambiguous-issue` | Multiple semantic matches require user confirmation. |
| `cross-worktree-resume` | One Git-common cache preserves distinct worktree entries for the same project. |
| `concurrent-human-edit` | Managed revision replacement preserves human-authored text. |
| `indeterminate-create` | An attempt fingerprint adopts one exact result and otherwise remains pending. |
| `secret-rejection` | Publishable evidence containing secret-like material is rejected. |
| `multiple-required-prs` | One merge cannot complete delivery while another required PR remains. |

Run the adjacent routing and generated-adapter contracts:

```bash
npm run test:routing
npm run build:adapters
npm run test:generated
```

Expected: routing reports `PASS`, the adapter build completes, and generated
drift reports that the committed adapter matches its source.

## Read-only repository dogfood

The current work uses Issue `#62`, Draft PR `#65`, and project ID
`github:R_kgDOR1XohQ`. These commands inspect them without creating or updating
remote objects:

```bash
gh issue view 62 --repo knotmark-ai/devmuse --json number,state,title,url
gh pr view 65 --repo knotmark-ai/devmuse \
  --json number,state,isDraft,headRefName,baseRefName,url
printf '%s\n' \
  '{"live_repository":{"id":"github:R_kgDOR1XohQ","repository":"github.com/knotmark-ai/devmuse"}}' \
  | node plugin/runtime/project-context/cli.mjs resolve
```

Expected: the Issue is open; the PR is open and draft with head
`feat/62-github-first-context` and base `main`; the resolver returns the same
project ID, `github-first`, and a verified identity. Search the Issue and PR
timeline for the exact work ID before any future create attempt; semantic title
similarity alone never authorizes reuse or creation.

Exercise the same commit from a temporary linked worktree:

```bash
fixture_root="$(mktemp -d)"
git worktree add --detach "$fixture_root/linked" HEAD
printf '%s\n' \
  '{"live_repository":{"id":"github:R_kgDOR1XohQ","repository":"github.com/knotmark-ai/devmuse"}}' \
  | (cd "$fixture_root/linked" && node plugin/runtime/project-context/cli.mjs resolve)
git worktree remove "$fixture_root/linked"
rmdir "$fixture_root"
```

Expected: the project ID and Git-common directory match the primary checkout,
while `worktree_key` differs. The resolver does not write a manifest, grant, or
credential into the linked checkout.

## Authorized live mutation boundary

Live mutation tests use a disposable fixture repository or the provider's
`--dry-run`; never use the DevMuse repository merely to manufacture evidence.
Before each Issue, PR, or comment mutation, validate the exact repository,
operation capability, work ID, and current authorization grant. After an
indeterminate response, run recovery by attempt fingerprint before retrying.

Store only sanitized evidence. Before publication, scan the proposed block and
require no matches:

```bash
rg -n '(gh[pousr]_[A-Za-z0-9_]{20,}|Authorization: Bearer|BEGIN .*PRIVATE KEY)' \
  path/to/proposed-evidence.md
```

Expected: `rg` exits `1` because no secret-like value is present. An exit of
`0` blocks publication until the evidence is cleaned.
