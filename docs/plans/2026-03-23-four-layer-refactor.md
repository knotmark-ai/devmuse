# 四层架构重构实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use craft-claude:craft-sdd (recommended) or craft-claude:craft-execute to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 craft-claude 插件从"全部塞在 skills/"的扁平结构重构为 rules/skills/agents/knowledge 四层架构。

**Architecture:** 创建 rules/、agents/、knowledge/ 顶层目录；将 13 个 skill 精简合并为 6 个；将分散的 agent prompt 合并为 2 个独立 agent；迁移 bootstrap.md 到 rules/；更新所有引用路径和 plugin.json。

**Tech Stack:** Claude Code plugin（Markdown skills、agent prompts、bash hooks、JSON config）

**设计文档：** `docs/craft-claude/specs/2026-03-23-four-layer-architecture-design.md`

---

## 文件结构（目标状态）

### 新建

```
rules/bootstrap.md                    ← hooks/bootstrap.md 迁移
agents/craft-reviewer.md              ← 合并 4 个审查 prompt
agents/craft-coder.md                 ← 改写 implementer-prompt.md
skills/craft-design/SKILL.md          ← craft-brainstorm 重命名+更新引用
skills/craft-code/SKILL.md            ← 合并 sdd+execute+tdd+worktree+parallel
skills/craft-code/testing-anti-patterns.md  ← 从 craft-tdd/ 迁移
skills/craft-review/SKILL.md          ← 合并 review+review-response+verify+finish
docs/four-layer-architecture.md       ← 设计文档移到顶层 docs/
```

### 删除（迁移后）

```
hooks/bootstrap.md                     → rules/bootstrap.md
skills/craft-brainstorm/               → skills/craft-design/
skills/craft-sdd/                      → skills/craft-code/ + agents/
skills/craft-execute/                  → skills/craft-code/
skills/craft-tdd/                      → skills/craft-code/
skills/craft-worktree/                 → skills/craft-code/
skills/craft-parallel/                 → skills/craft-code/
skills/craft-review-response/          → skills/craft-review/
skills/craft-verify/                   → skills/craft-review/
skills/craft-finish/                   → skills/craft-review/
docs/craft-claude/specs/              → docs/
docs/craft-claude/plans/              → docs/plans/
docs/skills-reference.md              → 过时，删除
docs/testing.md                       → 检查是否过时
docs/plans/2025-11-28-*               → 过时，删除
```

### 不变

```
skills/craft-plan/                     保持不变（更新 plan-document-reviewer 引用）
skills/craft-debug/                    保持不变
skills/craft-write-skill/              保持不变
hooks/hooks.json                       更新路径
hooks/session-start                    更新路径
knowledge/                             空目录，预留
```

---

### Task 1: 创建目录结构和 agents

**Files:**
- Create: `agents/craft-reviewer.md`
- Create: `agents/craft-coder.md`
- Create: `rules/` (目录)
- Create: `knowledge/` (目录)

- [ ] **Step 1: 创建目录**

```bash
mkdir -p rules agents knowledge
```

- [ ] **Step 2: 编写 agents/craft-reviewer.md**

合并以下 4 个文件的内容为一个三模式 agent：
- `skills/craft-review/craft-reviewer.md`（代码审查）
- `skills/craft-sdd/code-quality-reviewer-prompt.md`（代码质量审查）
- `skills/craft-sdd/spec-reviewer-prompt.md`（规格符合性审查）
- `skills/craft-brainstorm/spec-document-reviewer-prompt.md`（设计文档审查）

格式参考设计文档中的 agent 内容，使用 YAML frontmatter（name, description, tools, model），三种模式（A: 设计文档审查, B: 代码审查, C: 规格符合性审查）。

- [ ] **Step 3: 编写 agents/craft-coder.md**

改写自 `skills/craft-sdd/implementer-prompt.md`。使用 YAML frontmatter，保留：工作流程、代码组织、何时求助、自审清单、报告格式。

- [ ] **Step 4: 验证文件存在**

```bash
ls -la agents/ rules/ knowledge/
cat agents/craft-reviewer.md | head -5
cat agents/craft-coder.md | head -5
```

- [ ] **Step 5: 提交**

```bash
git add agents/ rules/ knowledge/
git commit -m "structural: 创建四层架构目录和 agent 文件"
```

---

### Task 2: 迁移 rules 和更新 hooks

**Files:**
- Create: `rules/bootstrap.md`
- Modify: `hooks/session-start`
- Delete: `hooks/bootstrap.md`（迁移后）

- [ ] **Step 1: 迁移 bootstrap.md**

```bash
cp hooks/bootstrap.md rules/bootstrap.md
```

- [ ] **Step 2: 更新 hooks/session-start**

将 `hooks/session-start` 中的路径从 `hooks/bootstrap.md` 改为 `rules/bootstrap.md`：

```bash
# 找到这行并替换路径
# 旧: bootstrap_content=$(cat "${PLUGIN_ROOT}/hooks/bootstrap.md" ...)
# 新: bootstrap_content=$(cat "${PLUGIN_ROOT}/rules/bootstrap.md" ...)
```

- [ ] **Step 3: 删除旧文件**

```bash
git rm hooks/bootstrap.md
```

- [ ] **Step 4: 验证 hook 能读到新路径**

```bash
# 确认路径正确
bash -c 'PLUGIN_ROOT=/Users/huiyu/Code/private/craft-claude; cat "${PLUGIN_ROOT}/rules/bootstrap.md" | head -3'
```

- [ ] **Step 5: 提交**

```bash
git add rules/bootstrap.md hooks/session-start
git commit -m "structural: 迁移 bootstrap.md 到 rules/ 并更新 hook 路径"
```

---

### Task 3: 创建 craft-design（重命名 craft-brainstorm）

**Files:**
- Create: `skills/craft-design/SKILL.md`
- Move: `skills/craft-brainstorm/visual-companion.md` → `skills/craft-design/`
- Move: `skills/craft-brainstorm/scripts/` → `skills/craft-design/`
- Delete: `skills/craft-brainstorm/`（迁移后）

- [ ] **Step 1: 创建目录**

```bash
mkdir -p skills/craft-design
```

- [ ] **Step 2: 编写 skills/craft-design/SKILL.md**

基于 `skills/craft-brainstorm/SKILL.md`，做以下修改：
- frontmatter name 改为 `craft-design`
- 标题改为 `# Design`（或保留英文风格）
- spec-document-reviewer 引用改为 `@../../agents/craft-reviewer.md`（模式 A）
- 链式调用终态从 `craft-plan` 不变
- 删除对 `elements-of-style:writing-clearly-and-concisely` 的引用（已删除）
- 保留 digraph 流程图、Visual Companion 章节、所有检查清单

- [ ] **Step 3: 迁移就近参考文件**

```bash
cp skills/craft-brainstorm/visual-companion.md skills/craft-design/
cp -r skills/craft-brainstorm/scripts skills/craft-design/
```

- [ ] **Step 4: 删除旧目录**

```bash
git rm -r skills/craft-brainstorm/
```

- [ ] **Step 5: 验证**

```bash
ls skills/craft-design/
head -5 skills/craft-design/SKILL.md
```

- [ ] **Step 6: 提交**

```bash
git add skills/craft-design/
git commit -m "structural: 重命名 craft-brainstorm 为 craft-design"
```

---

### Task 4: 创建 craft-code（合并 sdd+execute+tdd+worktree+parallel）

**Files:**
- Create: `skills/craft-code/SKILL.md`
- Move: `skills/craft-tdd/testing-anti-patterns.md` → `skills/craft-code/`
- Delete: `skills/craft-sdd/`, `skills/craft-execute/`, `skills/craft-tdd/`, `skills/craft-worktree/`, `skills/craft-parallel/`

- [ ] **Step 1: 创建目录**

```bash
mkdir -p skills/craft-code
```

- [ ] **Step 2: 编写 skills/craft-code/SKILL.md**

合并以下 skill 内容为一个完整的编码工作流：

**来源和合并逻辑：**
- `craft-sdd/SKILL.md`：子 agent 并发模式的核心流程（digraph、model selection、status handling、red flags）
- `craft-execute/SKILL.md`：当前会话顺序模式
- `craft-tdd/SKILL.md`：TDD 方法论（Iron Law、Red-Green-Refactor、rationalizations table、red flags）
- `craft-worktree/SKILL.md`：开始前创建隔离工作区（directory selection、safety verification、creation steps）
- `craft-parallel/SKILL.md`：并行 agent 调度策略

**结构设计：**
```markdown
---
name: craft-code
description: Use when you have an implementation plan ready to execute - supports subagent-driven and inline execution modes with TDD, worktree isolation, and review gates
---

# Code

## Overview
按计划执行实现任务。两种模式：子 agent 并发（推荐）或当前会话顺序。

## Process（digraph 描述完整流程）
1. 工作区隔离（原 craft-worktree 内容）
2. 选择执行模式
3. 逐任务执行（TDD 方法论约束）
4. 两阶段审查门禁

## Worktree Setup（原 craft-worktree 全部内容）
## Execution Modes
### Subagent-Driven（原 craft-sdd 核心）
### Inline（原 craft-execute 核心）
## TDD Discipline（原 craft-tdd 全部内容，包含 Iron Law、digraph、rationalizations table）
## Parallel Dispatch（原 craft-parallel 核心模式）
## Agent References
- @../../agents/craft-coder.md
- @../../agents/craft-reviewer.md
```

**关键原则：**
- 保留所有 digraph 流程图
- 保留 TDD 的 Iron Law、rationalizations table、red flags
- 保留 worktree 的 directory selection priority、safety verification
- 保留 sdd 的 model selection、status handling
- agent prompt 引用改为 `@../../agents/` 路径

- [ ] **Step 3: 迁移就近参考文件**

```bash
cp skills/craft-tdd/testing-anti-patterns.md skills/craft-code/
```

- [ ] **Step 4: 删除旧目录**

```bash
git rm -r skills/craft-sdd/ skills/craft-execute/ skills/craft-tdd/ skills/craft-worktree/ skills/craft-parallel/
```

- [ ] **Step 5: 验证**

```bash
ls skills/craft-code/
wc -l skills/craft-code/SKILL.md  # 检查内容完整性
```

- [ ] **Step 6: 提交**

```bash
git add skills/craft-code/
git commit -m "structural: 合并 sdd+execute+tdd+worktree+parallel 为 craft-code"
```

---

### Task 5: 重写 craft-review（合并 review+review-response+verify+finish）

**Files:**
- Rewrite: `skills/craft-review/SKILL.md`
- Delete: `skills/craft-review/craft-reviewer.md`（已迁移到 agents/）
- Delete: `skills/craft-review-response/`, `skills/craft-verify/`, `skills/craft-finish/`

- [ ] **Step 1: 编写新的 skills/craft-review/SKILL.md**

合并以下 skill 内容为完整的审查工作流：

**来源和合并逻辑：**
- `craft-review/SKILL.md`：触发审查、获取 git SHA、派遣 reviewer
- `craft-review-response/SKILL.md`：接收反馈的原则（forbidden responses、verify before implementing、pushback guidelines、YAGNI check）
- `craft-verify/SKILL.md`：验证纪律（Iron Law、gate function、common failures、red flags、rationalization prevention）
- `craft-finish/SKILL.md`：完成流程（verify tests、determine base branch、4 options、worktree cleanup）

**结构设计：**
```markdown
---
name: craft-review
description: Use when code changes need review, verification, and integration - covers review dispatch, feedback handling, verification gates, and merge/PR workflow
---

# Review

## Overview
审查代码变更、处理反馈、验证通过、完成集成。

## Process（digraph 描述完整流程）
审查 → 处理反馈 → 验证 → 集成

## Review Dispatch（原 craft-review）
## Handling Feedback（原 craft-review-response，包含 forbidden responses、pushback guidelines）
## Verification（原 craft-verify，包含 Iron Law、gate function、rationalizations table）
## Finish（原 craft-finish，包含 4 options、worktree cleanup）
## Agent References
- @../../agents/craft-reviewer.md
```

- [ ] **Step 2: 删除已迁移的 agent prompt**

```bash
git rm skills/craft-review/craft-reviewer.md
```

- [ ] **Step 3: 删除旧目录**

```bash
git rm -r skills/craft-review-response/ skills/craft-verify/ skills/craft-finish/
```

- [ ] **Step 4: 验证**

```bash
ls skills/craft-review/
wc -l skills/craft-review/SKILL.md
```

- [ ] **Step 5: 提交**

```bash
git add skills/craft-review/
git commit -m "structural: 合并 review+review-response+verify+finish 为 craft-review"
```

---

### Task 6: 更新 craft-plan 引用

**Files:**
- Modify: `skills/craft-plan/SKILL.md`
- Keep: `skills/craft-plan/plan-document-reviewer-prompt.md`

- [ ] **Step 1: 更新 SKILL.md 中的引用**

- 链式调用：`craft-sdd` → `craft-code`（子 agent 模式），`craft-execute` → `craft-code`（内联模式）
- 执行选择文案中引用 `craft-code` 而非 `craft-sdd`/`craft-execute`
- `craft-worktree` 引用删除（已融入 craft-code）

- [ ] **Step 2: 验证**

```bash
grep -n "craft-sdd\|craft-execute\|craft-worktree\|craft-brainstorm" skills/craft-plan/SKILL.md
# 应该无结果
```

- [ ] **Step 3: 提交**

```bash
git add skills/craft-plan/
git commit -m "structural: 更新 craft-plan 中的 skill 引用"
```

---

### Task 7: 更新 plugin.json 和清理

**Files:**
- Modify: `.claude-plugin/plugin.json`
- Move: `docs/craft-claude/specs/2026-03-23-four-layer-architecture-design.md` → `docs/`
- Delete: 过时文档

- [ ] **Step 1: 更新 plugin.json**

```json
{
  "name": "craft-claude",
  "description": "Core skills library for Claude Code: design, plan, code, review, debug workflows",
  "version": "0.2.0",
  "author": {
    "name": "Jeff"
  },
  "homepage": "https://github.com/huiyu/craft-claude",
  "repository": "https://github.com/huiyu/craft-claude",
  "license": "MIT",
  "keywords": ["skills", "tdd", "debugging", "collaboration", "best-practices", "workflows"],
  "agents": [
    "./agents/craft-reviewer.md",
    "./agents/craft-coder.md"
  ],
  "skills": ["./skills/"]
}
```

- [ ] **Step 2: 迁移设计文档到顶层 docs/**

```bash
mv docs/craft-claude/specs/2026-03-23-four-layer-architecture-design.md docs/four-layer-architecture.md
```

- [ ] **Step 3: 删除过时文档**

```bash
# 过时的计划和规格（已完成的历史记录）
git rm docs/plans/2025-11-28-skills-improvements-from-user-feedback.md
git rm docs/skills-reference.md
# 清理空目录
git rm -r docs/craft-claude/
```

保留 `docs/testing.md`（与当前工作相关）。

- [ ] **Step 4: 更新 bootstrap.md 中的 skill 引用**

检查 `rules/bootstrap.md`，确保引用的 skill 名称已更新：
- `craft-brainstorm` → `craft-design`
- 删除对 `craft-sdd`、`craft-execute`、`craft-tdd`、`craft-verify`、`craft-finish`、`craft-worktree`、`craft-parallel`、`craft-review-response` 的引用
- 添加 `craft-code` 和更新后的 `craft-review`

- [ ] **Step 5: 验证最终状态**

```bash
# 确认目录结构
find . -name "*.md" -not -path "./.git/*" -not -path "./node_modules/*" -not -path "./tests/*" | sort

# 确认没有悬空引用
grep -r "craft-brainstorm\|craft-sdd\|craft-execute\|craft-tdd\|craft-verify\|craft-finish\|craft-worktree\|craft-parallel\|craft-review-response" skills/ agents/ rules/ hooks/ --include="*.md" --include="*.json"

# 确认 plugin.json 有效
cat .claude-plugin/plugin.json | python3 -m json.tool
```

- [ ] **Step 6: 提交**

```bash
git add .
git commit -m "structural: 更新 plugin.json、清理过时文档、更新 bootstrap 引用"
```

---

### Task 8: 全面完整性检查

- [ ] **Step 1: 知识完整性检查**

验证所有原始内容都已保留（不是被删除，而是被合并到新位置）：

| 原文件 | 新位置 | 检查项 |
|--------|--------|--------|
| hooks/bootstrap.md | rules/bootstrap.md | 内容一致 |
| craft-brainstorm/SKILL.md | craft-design/SKILL.md | digraph 保留、checklist 保留 |
| craft-brainstorm/visual-companion.md | craft-design/visual-companion.md | 完整迁移 |
| craft-brainstorm/spec-document-reviewer-prompt.md | agents/craft-reviewer.md 模式A | 审查要点保留 |
| craft-brainstorm/scripts/ | craft-design/scripts/ | 完整迁移 |
| craft-sdd/SKILL.md | craft-code/SKILL.md | digraph 保留、model selection 保留、status handling 保留 |
| craft-sdd/implementer-prompt.md | agents/craft-coder.md | 工作流程、自审清单保留 |
| craft-sdd/spec-reviewer-prompt.md | agents/craft-reviewer.md 模式C | 审查要点保留 |
| craft-sdd/code-quality-reviewer-prompt.md | agents/craft-reviewer.md 模式B | 审查清单保留 |
| craft-execute/SKILL.md | craft-code/SKILL.md | 内联模式保留 |
| craft-tdd/SKILL.md | craft-code/SKILL.md | Iron Law、digraph、rationalizations table、red flags 全部保留 |
| craft-tdd/testing-anti-patterns.md | craft-code/testing-anti-patterns.md | 完整迁移 |
| craft-worktree/SKILL.md | craft-code/SKILL.md | directory selection、safety verification、creation steps 保留 |
| craft-parallel/SKILL.md | craft-code/SKILL.md | digraph、dispatch pattern 保留 |
| craft-review/SKILL.md | craft-review/SKILL.md | 审查触发流程保留 |
| craft-review/craft-reviewer.md | agents/craft-reviewer.md | 审查清单、输出格式保留 |
| craft-review-response/SKILL.md | craft-review/SKILL.md | forbidden responses、pushback guidelines、YAGNI check 保留 |
| craft-verify/SKILL.md | craft-review/SKILL.md | Iron Law、gate function、rationalizations table 保留 |
| craft-finish/SKILL.md | craft-review/SKILL.md | 4 options、worktree cleanup 保留 |
| craft-plan/SKILL.md | craft-plan/SKILL.md | 不变 |
| craft-plan/plan-document-reviewer-prompt.md | craft-plan/plan-document-reviewer-prompt.md | 不变 |
| craft-debug/SKILL.md + 附属文件 | craft-debug/ | 不变 |
| craft-write-skill/SKILL.md + 附属文件 | craft-write-skill/ | 不变 |

- [ ] **Step 2: 自洽性检查**

```bash
# 所有 agent 引用都指向存在的文件
grep -roh "@\.\./\.\./agents/[^ ]*" skills/ | sort -u | while read ref; do
  file=$(echo "$ref" | sed 's/@/skills\/craft-design\//;s/\.\.\///g')
  echo "Checking: $ref"
done

# 所有 skill 在 bootstrap 中被正确引用
grep "craft-" rules/bootstrap.md

# plugin.json 中的 agent 文件都存在
cat .claude-plugin/plugin.json | python3 -c "
import json, sys, os
data = json.load(sys.stdin)
for a in data.get('agents', []):
    path = a.lstrip('./')
    exists = os.path.exists(path)
    print(f'  {path}: {\"✅\" if exists else \"❌\"}')"
```

- [ ] **Step 3: 提交最终状态（如有修复）**

```bash
git add -A
git commit -m "fix: 完整性检查修复"
```
