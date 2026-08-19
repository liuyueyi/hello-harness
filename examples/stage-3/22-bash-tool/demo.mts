import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createBashTool } from "@hello-harness/coding";
import { Workspace } from "@hello-harness/coding";
import type { BashResult } from "@hello-harness/coding";
import type { ToolResult } from "@hello-harness/core";

function printResult(label: string, result: ToolResult): void {
  if (result.ok) {
    const value = result.value as BashResult;
    const timedOut = value.timedOut ? "（超时被终止）" : "";
    const show = (text: string) => (text.length > 100 ? `${text.slice(0, 100)}…（${text.length} 字符）` : JSON.stringify(text));
    console.log(`[ok]   ${label}`);
    console.log(`       → exitCode : ${value.exitCode}${timedOut}`);
    console.log(`         stdout   : ${show(value.stdout)}`);
    console.log(`         stderr   : ${show(value.stderr)}`);
  } else {
    console.log(`[fail] ${label}\n       → [${result.kind}] ${result.error}`);
  }
}

async function main() {
  const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), "hh-22-workspace-"));
  const bash = createBashTool(new Workspace(workspaceRoot));

  try {
    console.log("=== 1. 正常执行 → stdout 捕获、exitCode 0 ===");
    printResult('bash("echo hello harness")', await bash.execute({ command: "echo hello harness" }));

    console.log("=== 2. 命令运行在 workspace 根目录（cwd 生效） ===");
    printResult('bash("node -e \\"console.log(process.cwd())\\"")', await bash.execute({ command: 'node -e "console.log(process.cwd())"' }));

    console.log("=== 3. stdout / stderr 分离捕获 ===");
    printResult('bash("node -e \\"console.log(1); console.error(2)\\"")', await bash.execute({ command: 'node -e "console.log(1); console.error(2)"' }));

    console.log("=== 4. 非零退出码 → 结果仍返回，exitCode 保留 ===");
    printResult('bash("node -e \\"process.exit(3)\\"")', await bash.execute({ command: 'node -e "process.exit(3)"' }));

    console.log("=== 5. 超时 → 强制终止，timedOut 标记 ===");
    const bashShort = createBashTool(new Workspace(workspaceRoot), { timeoutMs: 500 });
    printResult('bash("node -e \\"setTimeout(()=>{}, 10000)\\"")', await bashShort.execute({ command: 'node -e "setTimeout(()=>{}, 10000)"' }));

    console.log("=== 6. 超长输出 → 自动截断 ===");
    printResult('bash("node -e \\"console.log(\\\'A\\\'.repeat(20000))\\\"")', await bash.execute({ command: 'node -e "console.log(\'A\'.repeat(20000))"' }));

    console.log("=== 7. command 缺失 → 拒绝（tool） ===");
    printResult("bash()", await bash.execute({}));

    console.log("=== 8. command 非字符串 → 拒绝（tool） ===");
    printResult("bash(123)", await bash.execute({ command: 123 as unknown }));
  } finally {
    await rm(workspaceRoot, { recursive: true, force: true });
  }
}

main();
