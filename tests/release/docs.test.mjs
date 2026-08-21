import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "../..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("UC-9: English and Chinese platform docs use the smallest release archives", () => {
  for (const file of ["docs/platform-support.md", "docs/platform-support_cn.md"]) {
    const body = read(file);
    for (const host of ["claude", "codex", "gemini", "hermes"]) {
      assert.match(body, new RegExp(`devmuse-<version>-${host}\\.tar\\.gz`), `${file}: ${host}`);
    }
    assert.match(body, /SHA256SUMS/);
    assert.match(body, /marketplace-submission\.md/);
    assert.match(body, /(?:no repository clone is required|无需克隆仓库)/i);
    assert.doesNotMatch(body, /Known distribution gap|已知分发缺口/);
  }
});

test("UC-9: each host section presents its release archive before any source-development path", () => {
  const contracts = {
    "docs/platform-support.md": {
      "Claude Code": "claude",
      "Codex CLI and ChatGPT Work": "codex",
      OpenClaw: "claude",
      "Hermes Agent CLI and Desktop": "hermes",
      "Gemini CLI": "gemini",
    },
    "docs/platform-support_cn.md": {
      "Claude Code": "claude",
      "Codex CLI 与 ChatGPT Work": "codex",
      OpenClaw: "claude",
      "Hermes Agent CLI 与 Desktop": "hermes",
      "Gemini CLI": "gemini",
    },
  };
  for (const [file, hosts] of Object.entries(contracts)) {
    const body = read(file);
    for (const [heading, archive] of Object.entries(hosts)) {
      const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const section = body.match(new RegExp(`### ${escaped}\\n([\\s\\S]*?)(?=\\n### |\\n## )`))?.[1];
      assert.ok(section, `${file}: missing ${heading}`);
      const archivePosition = section.indexOf(`devmuse-<version>-${archive}.tar.gz`);
      const sourcePosition = section.search(/source-based development|live source development|源码开发|源码实时开发/i);
      assert.ok(archivePosition >= 0, `${file}: ${heading} lacks its archive`);
      assert.ok(sourcePosition < 0 || archivePosition < sourcePosition, `${file}: ${heading} does not lead with its archive`);
    }
  }
});

test("UC-4 UC-R5: platform docs map OpenClaw to Claude without a duplicate archive", () => {
  assert.match(read("docs/platform-support.md"), /OpenClaw[\s\S]*Claude archive[\s\S]*no separate OpenClaw archive/i);
  assert.match(read("docs/platform-support_cn.md"), /OpenClaw[\s\S]*Claude 归档[\s\S]*不生成单独的 OpenClaw 归档/);
});

test("UC-1 UC-2: testing twins document local release validation", () => {
  for (const file of ["docs/testing.md", "docs/testing_cn.md"]) {
    const body = read(file);
    assert.match(body, /npm run test:release/);
    assert.match(body, /release:build/);
    assert.match(body, /release:verify/);
    assert.match(body, /release:smoke/);
    assert.match(body, /release:finalize/);
  }
});

test("UC-9: README twins point to release artifacts without copying an inventory", () => {
  assert.match(read("README.md"), /host-specific release archive[\s\S]*platform support and installation guide/i);
  assert.match(read("README_CN.md"), /宿主专用发布归档[\s\S]*平台支持与安装指南/);
});
