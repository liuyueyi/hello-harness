import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Workspace } from "@hello-harness/coding";
import { ToolRegistry } from "@hello-harness/core";
import { ExtensionRegistry, PackageLoader } from "@hello-harness/extensions";
import { createDefaultPermissionGate } from "@hello-harness/coding";
import type { ToolCall } from "@hello-harness/core";

const repoRoot = fileURLToPath(new URL("../../../", import.meta.url));

const scratch = path.join(os.tmpdir(), "hello-harness-package-demo");
rmSync(scratch, { recursive: true, force: true });
mkdirSync(path.join(scratch, "src"), { recursive: true });
writeFileSync(path.join(scratch, "README.md"), "# hello package demo\n", "utf-8");
writeFileSync(path.join(scratch, "src", "index.ts"), "export const x = 1;\n", "utf-8");
execFileSync("git", ["init", "-b", "main"], { cwd: scratch, stdio: "ignore" });
execFileSync("git", ["config", "user.email", "demo@example.com"], { cwd: scratch, stdio: "ignore" });
execFileSync("git", ["config", "user.name", "demo"], { cwd: scratch, stdio: "ignore" });
execFileSync("git", ["add", "."], { cwd: scratch, stdio: "ignore" });
execFileSync("git", ["commit", "-m", "init"], { cwd: scratch, stdio: "ignore" });
writeFileSync(path.join(scratch, "src", "index.ts"), "export const x = 2;\n", "utf-8");

const workspace = new Workspace(scratch);
const registry = new ToolRegistry();
const extensions = new ExtensionRegistry({ tools: registry });

const loader = new PackageLoader();
const gitPkg = await loader.load(path.join(repoRoot, "plugins", "git"), workspace);
const webPkg = await loader.load(path.join(repoRoot, "plugins", "web"), workspace);
extensions.install(gitPkg.extension);
extensions.install(webPkg.extension);

const gate = createDefaultPermissionGate();
registry.attachGate(gate);
let approved = true;
gate.setAsk(async (_call, _reason) => approved);

function firstLine(text: string): string {
  return text.split("\n").find((line) => line.trim() !== "") ?? "";
}

async function show(label: string, call: ToolCall): Promise<void> {
  const decision = await gate.check(call);
  const verdict = decision.allowed
    ? "允许（ask 已获批准）"
    : "拒绝 [ask]";
  console.log(`  ${label}`);
  console.log(`    决策 → ${verdict}（${decision.decision.reason}）`);
  const result = await registry.execute(call);
  if (!result.ok) {
    console.log(`    结果 → 失败：${result.error}（kind=${result.kind} · retryable=${result.retryable}）`);
    return;
  }
  const value = result.value as { stdout?: string; stderr?: string; exitCode?: number };
  console.log(`    结果 → 执行成功：stdout=${JSON.stringify(firstLine(value.stdout ?? ""))}（exitCode=${value.exitCode}）`);
}

console.log("=== 38 · Package / Plugin：扩展独立发布 ===");

console.log("\n=== 1. 从磁盘加载独立包（读 package.json → 解析入口 → import → 工厂） ===");
for (const pkg of [gitPkg, webPkg]) {
  console.log(`  清单 ${pkg.manifest.name}@${pkg.manifest.version} · 入口 ${path.basename(pkg.entry)}`);
  console.log(`    扩展 ${pkg.extension.name}@${pkg.extension.version ?? "-"} — ${pkg.extension.description ?? ""}`);
}

console.log("\n=== 2. 已安装扩展（manifest） ===");
for (const ext of extensions.list()) {
  console.log(`  ${ext.name}@${ext.version ?? "-"} (${ext.status}) — ${ext.description ?? ""}`);
}

console.log("\n=== 3. 默认权限门不认新包：git / fetch_url 一律 ask ===");
for (const policy of gate.list()) {
  console.log(`  ${policy.name} · ${policy.description}`);
}

console.log("\n=== 4. git 包：只读工具（ask 批准后执行） ===");
await show('git_status()', { id: "g1", name: "git_status", arguments: {} });
await show('git_diff()', { id: "g2", name: "git_diff", arguments: {} });
console.log('  git_log()（ask 批准后执行，提交 hash 每机不同不展示内容）');
const logDecision = await gate.check({ id: "g3", name: "git_log", arguments: {} });
console.log(`    决策 → ${logDecision.allowed ? "允许（ask 已获批准）" : "拒绝 [ask]"}（${logDecision.decision.reason}）`);
const logResult = await registry.execute({ id: "g3", name: "git_log", arguments: {} });
if (!logResult.ok) {
  console.log(`    结果 → 失败：${logResult.error}（kind=${logResult.kind}）`);
} else {
  const value = logResult.value as { exitCode?: number };
  console.log(`    结果 → 执行成功（exitCode=${value.exitCode}）`);
}

console.log("\n=== 5. web 包：fetch_url 出网 → ask 拒绝 = 不出网 ===");
approved = false;
await show('fetch_url("https://example.com")', { id: "w1", name: "fetch_url", arguments: { url: "https://example.com" } });

registry.attachGate(gate);
console.log("");