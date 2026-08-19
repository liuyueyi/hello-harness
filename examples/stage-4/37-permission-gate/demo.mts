import { mkdirSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { Workspace } from "@hello-harness/coding";
import { ToolRegistry } from "@hello-harness/core";
import type { ToolCall } from "@hello-harness/core";
import { calculator } from "@hello-harness/coding";
import { createReadTool } from "@hello-harness/coding";
import { createWriteTool } from "@hello-harness/coding";
import { createBashTool } from "@hello-harness/coding";
import { createDefaultPermissionGate } from "@hello-harness/coding";

const scratch = path.join(os.tmpdir(), "hello-harness-permission-demo");
mkdirSync(path.join(scratch, "notes"), { recursive: true });
writeFileSync(path.join(scratch, "notes", "demo.txt"), "hello harness", "utf-8");

const registry = new ToolRegistry();
registry.register(calculator);
registry.register(createReadTool(new Workspace(scratch)));
registry.register(createWriteTool(new Workspace(scratch)));
registry.register(createBashTool(new Workspace(scratch)));

const gate = createDefaultPermissionGate();
registry.attachGate(gate);

let approved = true;
gate.setAsk(async (_call, _reason) => approved);

function summarize(result: Awaited<ReturnType<ToolRegistry["execute"]>>): string {
  if (!result.ok) return `失败：${result.error}（kind=${result.kind} · retryable=${result.retryable}）`;
  const value = result.value as { value?: unknown; stdout?: string; exitCode?: number | null };
  if (value.stdout !== undefined) return `执行成功：stdout=${JSON.stringify(value.stdout.split("\n")[0])}（exitCode=${value.exitCode}）`;
  if (value.value !== undefined) return `执行成功：value=${JSON.stringify(value.value)}`;
  if (typeof result.value === "number" || typeof result.value === "string") {
    return `执行成功：value=${JSON.stringify(result.value)}`;
  }
  return "执行成功";
}

async function show(label: string, call: ToolCall): Promise<void> {
  const decision = await gate.check(call);
  const action = decision.decision.action;
  const note = decision.decision.reason ? `（${decision.decision.reason}）` : "";
  const verdict = decision.allowed
    ? action === "ask"
      ? "允许（ask 已获批准）"
      : "允许 [allow]"
    : action === "ask"
      ? "拒绝 [ask]"
      : "拒绝 [deny]";
  console.log(`  ${label}`);
  console.log(`    决策 → ${verdict}${note}`);
  const result = await registry.execute(call);
  console.log(`    结果 → ${summarize(result)}`);
}

console.log("=== 37 · Permission Gate：allow / deny / ask ===");

console.log("\n=== 1. 已安装的权限策略 ===");
for (const policy of gate.list()) {
  console.log(`  ${policy.name} · ${policy.description}`);
}

console.log("\n=== 2. allow：只读工具 / 只读命令直接放行 ===");
await show("calculator(17 * 38)", { id: "c1", name: "calculator", arguments: { expression: "17 * 38" } });
await show('read("notes/demo.txt")', { id: "c2", name: "read", arguments: { path: "notes/demo.txt" } });
await show('bash("dir")', { id: "c3", name: "bash", arguments: { command: "dir" } });
await show('bash("cd notes")', { id: "c4", name: "bash", arguments: { command: "cd notes" } });
await show('bash("node --version")', { id: "c5", name: "bash", arguments: { command: "node --version" } });
await show('bash("dir && echo ok")（拼接命令不在只读名单，交给 ask）', { id: "c6", name: "bash", arguments: { command: "dir && echo ok" } });

console.log("\n=== 3. deny：危险命令 / 敏感文件直接拒绝 ===");
await show('bash("rm -rf node_modules")', { id: "c7", name: "bash", arguments: { command: "rm -rf node_modules" } });
await show('write(".env", "KEY=secret")', { id: "c8", name: "write", arguments: { path: ".env", content: "KEY=secret" } });
await show('bash("rm -rf .")', { id: "c9", name: "bash", arguments: { command: "rm -rf ." } });

console.log("\n=== 4. ask：交给用户，批准则执行 ===");
approved = true;
await show('write("notes/hello.txt", "hi")', { id: "c10", name: "write", arguments: { path: "notes/hello.txt", content: "hi" } });
approved = false;
await show('bash("node -e \\"console.log(1 + 1)\\"")', { id: "c11", name: "bash", arguments: { command: 'node -e "console.log(1 + 1)"' } });

console.log("\n=== 5. fail-closed：没装 ask 处理器 = 一律拒绝 ===");
const gateNoAsk = createDefaultPermissionGate();
registry.attachGate(gateNoAsk);
await show('bash("node -e \\"console.log(1 + 1)\\"")（无 ask 处理器）', { id: "c12", name: "bash", arguments: { command: 'node -e "console.log(1 + 1)"' } });

console.log("\n=== 6. auto-approve：ask 自动批准 ===");
const gateAuto = createDefaultPermissionGate();
gateAuto.setAsk(async () => true);
registry.attachGate(gateAuto);
await show('bash("node -e \\"console.log(1 + 1)\\"")（auto-approve）', { id: "c13", name: "bash", arguments: { command: 'node -e "console.log(1 + 1)"' } });

registry.attachGate(gate);
console.log("");