# Platform support

DevMuse uses one workflow source and thin host adapters. It does not try to make every agent behave like Claude Code.

## Support matrix

| Host | Distribution | Invocation policy | Host-native capabilities kept authoritative |
|---|---|---|---|
| Claude Code | Claude marketplace bundle in `plugin/` | Bootstrap routes direct, bounded, and architectural work; six product/meta skills stay explicit | Claude agents and `PreToolUse` hook |
| Codex CLI / ChatGPT Work | Codex plugin in `adapters/codex/` | `mu-scope`, `mu-arch`, and `mu-debug` may invoke on a description match; `mu-code` additionally requires an execution request plus a recognized DevMuse contract; the rest are explicit `$mu-*` skills | Native `/plan`, `/review`, task tracking, subagents, sandbox, and approvals |
| OpenClaw | Installs the Claude or Codex directory as a compatible bundle | Uses skill metadata; manual skills remain manual in the Claude bundle | OpenClaw approvals, sandbox, agents, and skill allowlists |
| Hermes Agent CLI / Desktop | Hermes plugin at repository root | Plugin skills are explicit and namespaced as `devmuse:mu-*` by default | Hermes `plan` skill, learning loop, memory, tool permissions, and plugin lifecycle |
| Gemini CLI | Gemini extension metadata in `plugin/` | Lightweight `GEMINI.md` allows scope, architecture, and debug on a description match, plus contract-gated code execution | Native Plan Mode, task tracking, validation, hooks, and approvals |
| Cursor, GitHub Copilot CLI, OpenCode, Cline, Windsurf, Goose, and other Agent Skills hosts | Portable pack generated in `adapters/codex/skills/` | Host decides activation; OpenAI policy metadata is ignored by non-Codex hosts | Each host's planning, review, agents, and permissions |

The portable pack follows the [Agent Skills specification](https://agentskills.io/specification). Its support files are vendored into each skill, so copying one skill does not break DevMuse's knowledge or reviewer references.

## Why policies differ

DevMuse adds value where a host needs product framing, risk classification, traceable architecture, systematic debugging, or specialized coverage/security review. It should not replace capabilities the host already performs well.

- Ordinary Codex planning uses `/plan`. `mu-plan` is reserved for an approved architecture that needs a durable plan with UC-ID traceability.
- Ordinary Codex review uses `/review`. `mu-review` is reserved for requirements coverage, security, or an explicitly authorized review-and-fix loop.
- `mu-code` stays out of ordinary Codex implementation. It may invoke automatically only when the user asks to execute a mu-scope `bounded execution` contract or an approved DevMuse plan; a generic coding request, design, or unapproved specification does not pass the gate.
- Hermes keeps plugin skills out of its startup index by default. This preserves its progressive-disclosure and learning model instead of loading a second global workflow.
- Claude keeps the full bootstrap because it is the only adapter whose routing, subagents, and guard hook are currently behavior-tested in this repository.

These defaults are intentionally conservative. Automatic `mu-code` takeover is
contract-gated; explicit invocation remains available for users who want to
resume or override routing deliberately.

## Safety boundary

DevMuse does not promise cross-host parity for its Claude destructive-command
guard. Tool hooks are guardrails, while the host's sandbox, approval policy,
tool permissions, and administrator policy remain the enforcement boundary.

| Host | DevMuse default | Reason |
|---|---|---|
| Claude Code | Ships the tested `PreToolUse` warning guard | Claude can turn the guard's `ask` decision into a user prompt; native permissions still apply afterward |
| Codex | Ships no duplicate guard | Native sandbox and approvals are authoritative; `PreToolUse` can deny a call but cannot currently request approval, so copying the Claude response would fail open |
| Gemini CLI | Ships no policy override | Its native policy engine already supports `allow`, `deny`, and `ask_user`; an extension should not silently install user or administrator policy |
| OpenClaw | Ships no native hook pack | `before_tool_call` can request approval, but existing sandbox, execution approval, owner, and channel policies still apply |
| Hermes Agent | Ships no guard hook | `pre_tool_call` can block but cannot reproduce a warning-and-confirm flow |

A future safety pack must be separately opted into, use the host's native policy
format, never grant past host policy, and include behavior tests for safe,
warning, denial, malformed-input, and non-interactive cases. It must also state
its actual coverage instead of implying that every tool path is intercepted.

## Install

### Claude Code

```text
/plugin marketplace add knotmark-ai/devmuse
/plugin install devmuse@devmuse
```

Only `plugin/` is installed from the marketplace entry; repository `docs/` and `tests/` are not part of the Claude runtime.

### Codex CLI and ChatGPT Work

Add the repository marketplace with a sparse checkout, then install DevMuse from `/plugins` in a new Codex session:

```bash
codex plugin marketplace add knotmark-ai/devmuse \
  --sparse .agents/plugins \
  --sparse adapters/codex
codex
```

Then enter `/plugins`, select the `devmuse` marketplace, and install DevMuse. Invoke an explicit skill with `$mu-plan`, `$mu-review`, and so on. `$mu-code` may be named explicitly, but it can also take over after a qualifying DevMuse execution contract.

For local development:

```bash
codex plugin marketplace add /absolute/path/to/devmuse
```

Restart the session after rebuilding the adapter.

### OpenClaw

OpenClaw can install Claude-compatible marketplaces directly:

```bash
openclaw plugins install devmuse --marketplace knotmark-ai/devmuse
openclaw plugins inspect devmuse
openclaw gateway restart
```

For local development, link the runtime directory:

```bash
openclaw plugins install --link /absolute/path/to/devmuse/plugin
```

OpenClaw maps skills, but it only detects Claude `agents/` and `hooks/hooks.json`; it does not execute them. DevMuse therefore relies on OpenClaw's native safety and agent facilities, as defined in the safety boundary above.

### Hermes Agent CLI and Desktop

```bash
hermes plugins install knotmark-ai/devmuse --enable
```

The default lightweight mode registers explicit namespaced skills without adding all descriptions to the startup prompt. Ask Hermes, for example:

```text
Load the devmuse:mu-scope skill, then scope this authentication change.
```

If you prefer normal `/mu-scope` commands and automatic skill discovery, add the installed skill directory to `~/.hermes/config.yaml`:

```yaml
skills:
  external_dirs:
    - ~/.hermes/plugins/devmuse/plugin/skills
```

This integrated mode lets Hermes modify external skills if the directory is writable. Keep the plugin directory read-only when you do not want its learning loop to edit DevMuse.

### Gemini CLI

Gemini installs an extension from a directory or Git repository root. DevMuse's Gemini root is the runtime subdirectory, so clone once and install that path:

```bash
git clone https://github.com/knotmark-ai/devmuse.git
gemini extensions install ./devmuse/plugin
```

For live local development:

```bash
gemini extensions link /absolute/path/to/devmuse/plugin
```

Restart Gemini CLI after installation. `GEMINI.md` is intentionally small; the full skills remain on-demand.

### Cursor, GitHub Copilot CLI, OpenCode, Windsurf, and other Agent Skills hosts

With GitHub CLI 2.90 or newer, clone the repository and install the generated portable pack for the target host:

```bash
git clone https://github.com/knotmark-ai/devmuse.git
gh skill install ./devmuse/adapters/codex --from-local --agent cursor --scope user
```

Select the DevMuse skills you want when prompted. Replace `cursor` with
`github-copilot`, `opencode`, `cline`, `windsurf`, `goose`, or another value
listed by `gh skill install --help`. Project scope is preferable for
team-specific use; user scope makes the selected skills visible in every
repository.

## Build and validate adapters

`plugin/skills/` is the source of truth. Do not edit generated files under `adapters/codex/skills/` directly.

```bash
npm run build:adapters
npm run test:platforms
```

The build strips Claude-only invocation frontmatter, vendors every cross-root dependency into the skill, and creates Codex `agents/openai.yaml` policy. Validation checks inventory parity, portable references, host policy, manifests, and the official Codex ingestion contract.

## Known distribution gap

Claude and Codex marketplace installs can select only the runtime subtree. Hermes Git installs and the current Gemini clone-first flow may fetch the repository documentation and tests too. Platform-specific release archives and registry submissions are tracked in [#49](https://github.com/knotmark-ai/devmuse/issues/49).

## Primary format references

- [Agent Skills specification](https://agentskills.io/specification)
- [Codex and ChatGPT plugin packaging](https://developers.openai.com/plugins/build/plugins)
- [Codex hooks](https://developers.openai.com/codex/config-advanced/#hooks)
- [OpenClaw compatible plugin bundles](https://docs.openclaw.ai/plugins/bundles)
- [OpenClaw plugin hooks](https://docs.openclaw.ai/plugins/hooks)
- [Hermes Agent skills](https://hermes-agent.nousresearch.com/docs/user-guide/features/skills/)
- [Hermes Agent plugins](https://hermes-agent.nousresearch.com/docs/user-guide/features/plugins/)
- [Hermes Agent event hooks](https://hermes-agent.nousresearch.com/docs/user-guide/features/hooks/)
- [Gemini CLI extension format](https://github.com/google-gemini/gemini-cli/blob/main/docs/extensions/reference.md)
- [Gemini CLI policy engine](https://geminicli.com/docs/reference/policy-engine/)
- [GitHub Copilot Agent Skills](https://docs.github.com/en/copilot/how-tos/copilot-on-github/customize-copilot/customize-cloud-agent/add-skills)
