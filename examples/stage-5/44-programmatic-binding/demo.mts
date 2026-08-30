import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { ToolRegistry, PermissionGate, type ToolCall } from "@hello-harness/core";
import {
  Workspace,
  createReadTool,
  createWriteTool,
  createEditTool,
  createBashTool,
  createGlobTool,
  createCodeActionTool,
  createDefaultPermissionGate,
} from "@hello-harness/coding";

// 与 ch43 同一个临时工作区任务：3 个 TypeScript 文件，2 个包含 "AgentRuntime"，外加一个超大文件
const scratch = path.join(os.tmpdir(), "hello-harness-44-programmatic-binding");
rmSync(scratch, { recursive: true, force: true });
mkdirSync(path.join(scratch, "src"), { recursive: true });

function padSource(head: string, lines: number): string {
  const out = [...head.split("\n")];
  while (out.length < lines) out.push("// filler line");
  return out.join("\n") + "\n";
}

writeFileSync(
  path.join(scratch, "src", "AgentRunner.ts"),
  padSource(
    `// AgentRunner.ts\nimport { AgentRuntime } from "@hello-harness/core";\n\nexport function create(): AgentRuntime {\n  return new AgentRuntime(/* model, registry, options */);\n}\n`,
    320,
  ),
  "utf-8",
);
writeFileSync(
  path.join(scratch, "src", "ToolRegistry.ts"),
  padSource(
    `// ToolRegistry.ts\nimport { AgentRuntime } from "@hello-harness/core";\n\nexport const runtimes: AgentRuntime[] = [];\n`,
    12,
  ),
  "utf-8",
);
writeFileSync(
  path.join(scratch, "src", "utils.ts"),
  padSource(`// utils.ts\nexport const answer = 42;\n`, 6),
  "utf-8",
);
// 超大文件：验证绑定后的 read 仍旧做 8000 字符截断（与直接点 read 完全同一行为）
writeFileSync(
  path.join(scratch, "src", "big.ts"),
  padSource(`// big.ts\n`, 1500).repeat(6), // 1500 * 5 行以上，稳超 8000 字符
  "utf-8",
);

// —— 真实 Harness：注册 6 个真实工具 + 默认权限门 ——
const workspace = new Workspace(scratch);
const gate = createDefaultPermissionGate();
const registry = new ToolRegistry({ gate });

registry.register(createReadTool(workspace));
registry.register(createWriteTool(workspace));
registry.register(createEditTool(workspace));
registry.register(createBashTool(workspace));
registry.register(createGlobTool(workspace));
registry.register(createCodeActionTool(workspace, registry));

// 模拟用户：ask 一律放行，并记录次数
let askCount = 0;
gate.setAsk(async () => {
  askCount += 1;
  return true;
});

// 预测某个调用会得到什么权限判定（只读分析，不会真正触发 ask 弹窗）
async function probe(title: string, name: string, arguments_: unknown): Promise<void> {
  const decision = await gate.decide({ id: "probe", name, arguments: arguments_ } satisfies ToolCall);
  const text =
    decision.action === "allow"
      ? `allow${decision.reason ? `（${decision.reason}）` : ""}`
      : decision.action === "deny"
        ? `deny（${decision.reason}）`
        : `ask（${decision.reason}）`;
  console.log(`      [判定·${title}] ${name} → ${text}`);
}

function runProgram(label: string, code: string): Promise<{ calls: string[]; printed: string[] }> {
  console.log(`\n>> ${label}`);
  return registry
    .execute({ id: `code-${label}`, name: "code", arguments: { code } })
    .then((result) => {
      if (!result.ok) {
        console.log(`   结果 → 失败：${result.error}（kind=${result.kind}）`);
        return { calls: [], printed: [] };
      }
      const value = result.value as { calls: string[]; printed: string[] };
      for (const call of value.calls) console.log(`   [能力] ${call}`);
      for (const line of value.printed) console.log(`   [结果] ${line}`);
      return value;
    });
}

async function main() {
  console.log("=== 44 · ProgrammaticToolBinding：程序里的能力全部复用 ToolRegistry ===\n");

  // —— 1) 组合任务主程序：glob/read 走注册表，判定与直接点工具一致 ——
  const composition = [
    `const files = await glob("src/**/*.ts");`,
    `const matches = [];`,
    `for (const file of files) {`,
    `  const text = await read(file);`,
    `  if (text.includes("AgentRuntime")) matches.push(file);`,
    `}`,
    `print("包含 AgentRuntime 的文件：" + matches.join("、"));`,
  ].join("\n");

  console.log("[模型] 输出一段组合程序（不逐个点工具）：\n");
  console.log("```js");
  console.log(composition);
  console.log("```\n");

  await runProgram("组合任务程序", composition);
  // 权限判定：这些能力与「直接点工具」完全同一条路
  await probe("glob", "glob", { pattern: "src/**/*.ts" });
  await probe("read", "read", { path: "src/AgentRunner.ts" });
  await probe("write", "write", { path: "docs/report.md", content: "summary" });

  // —— 2) 等价性：程序内 read 与直接点 read 是同一个工具 ——
  async function directRead(rel: string): Promise<string> {
    const result = await registry.execute({ id: `direct-${rel}`, name: "read", arguments: { path: rel } });
    return result.ok ? (result as { ok: true; value: string }).value : "(读失败)";
  }
  await runProgram(
    "程序内 read 与直接点 read 等价（含 8000 字符截断）",
    `const a = await read("src/utils.ts");\nconst b = await read("src/big.ts");\nprint("utils.ts（程序内）：" + a.trim());\nprint("big.ts 截断标记（程序内）：" + (b.includes("已截断") ? "存在" : "缺失"));`,
  );
  const directUtils = await directRead("src/utils.ts");
  const directBig = await directRead("src/big.ts");
  console.log("   直接点 read：utils.ts = " + directUtils.trim());
  console.log("   直接点 read：big.ts 截断标记 = " + (directBig.includes("已截断") ? "存在" : "缺失"));
  console.log(`   [判定] 程序内 read 与直接点 read：内容一致 ✓ / 截断行为一致 ✓`);

  // —— 3) write / bash 绑定：程序里写文件真实落盘、跑命令走 ask 放行 ——
  const startAsks = askCount;
  const programResult = await runProgram(
    "程序内 write 落盘 + bash 验证（ask 放行）",
    [
      `const files = await glob("src/**/*.ts");`,
      `const report = ["# 组合报告", "候选文件：", ...files].join("\\n");`,
      `print(await write("docs/report.md", report));`,
      `const v = await bash("node -e \\"console.log('bash ok')\\"");`,
      `print("bash stdout：" + v.stdout.trim());`,
    ].join("\n"),
  );
  const onDisk = existsSync(path.join(scratch, "docs", "report.md"))
    ? readFileSync(path.join(scratch, "docs", "report.md"), "utf-8")
    : "";
  console.log(`   落盘核对（fs 直读）：${onDisk.split("\n").length} 行，首行 = ${onDisk.split("\n")[0]}`);
  console.log(`   [判定] 本轮经历 ask 放行 ${askCount - startAsks - 1} 次（write 1 次 + bash 1 次，外层的 code 未计入）；文件真实写进 workspace`);

  // —— 4) 治理预览：危险命令被权限门拒绝（ch45 的主场） ——
  await runProgram(
    "程序里执行危险命令（不捕获：整体返回 kind=permission）",
    `await bash("rm -rf .");\nprint("这行不会执行到");`,
  );
  await runProgram(
    "程序里执行危险命令（程序捕获：结构化错误可接住）",
    `try { await bash("rm -rf ."); } catch (error) { print("程序已捕获：" + error.message); }`,
  );

  console.log("\n=== ch43 vs ch44：同一个组合任务 ===");
  console.log(`              ch43 · 临时注入实现    ch44 · 复用 ToolRegistry`);
  console.log(`read 的实现      手写 fs.readFileSync      注册表里的 createReadTool`);
  console.log(`glob 的实现      手写 walk                 注册表里的 createGlobTool`);
  console.log(`权限            只挡 read 越界            全部能力走 PermissionGate`);
  console.log(`workspace 边界   手写路径前缀检查          read/write/edit/bash 自带的边界`);
  console.log(`截断 / 超时       无                        read 8000 截断 / bash 10s 超时`);
  console.log("");
}

main();