import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { ToolRegistry } from "@hello-harness/core";
import { Workspace, createCodeActionTool, createReadTool, createGlobTool } from "@hello-harness/coding";

// 与 ch42 同一个临时工作区任务：3 个 TypeScript 文件，2 个包含 "AgentRuntime"
const scratch = path.join(os.tmpdir(), "hello-harness-43-code-action-demo");
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
  padSource(`// utils.ts\nexport const answer = 42;\n`, 5),
  "utf-8",
);

// —— 真实能力：注册 hello-coding 的 code 工具，直接用 ToolRegistry 执行 ——
const workspace = new Workspace(scratch);
const registry = new ToolRegistry();
registry.register(createCodeActionTool(workspace, registry));
registry.register(createGlobTool(workspace));
registry.register(createReadTool(workspace));

function runCode(label: string, code: string): Promise<void> {
  console.log(`\n>> ${label}`);
  return registry
    .execute({ id: `c-${label}`, name: "code", arguments: { code } })
    .then((result) => {
      if (!result.ok) {
        console.log(`   结果 → 失败：${result.error}（kind=${result.kind}）`);
        return;
      }
      const value = result.value as { printed: string[]; calls: string[] };
      for (const call of value.calls) console.log(`   [能力] ${call}`);
      for (const line of value.printed) console.log(`   [结果] ${line}`);
    });
}

async function main() {
  console.log("=== 43 · Code as Action：真实 code 工具执行一次程序 ===\n");

  const plainProgram = [
    `const files = await glob("src/**/*.ts");`,
    `const matches = [];`,
    `for (const file of files) {`,
    `  const text = await read(file);`,
    `  if (text.includes("AgentRuntime")) matches.push(file);`,
    `}`,
    `print("包含 AgentRuntime 的文件：" + matches.join("、"));`,
  ].join("\n");

  console.log("[模型决策 1] 输出一段程序（而不是逐个点工具）：\n");
  console.log("```js");
  console.log(plainProgram);
  console.log("```\n");
  console.log(`[Harness] 调用真实工具：code({ code })（hello-coding 第 8 个工具）`);
  await runCode("正常程序", plainProgram);

  // —— 模型把程序包进 ```js 围栏：工具自动剥离后正常执行 ——
  await runCode(
    "带 Markdown 围栏的程序（自动剥离）",
    "```js\nconst lines = await read(\"src/utils.ts\");\nprint(\"utils.ts 行数：\" + lines.split(\"\\n\").length);\n```",
  );

  // —— 真实模型常写的 require：注入的是 workspace 基准的 require ——
  await runCode(
    "用 require 加载模块（不再报 require is not defined）",
    `const pathLib = require("path");\nconst rel = await glob("src/**/*.ts");\nprint(pathLib.basename(rel[0]));`,
  );

  // —— 编译错误：错误消息带上「程序开头」，模型一眼能看出是哪一段坏了 ——
  await runCode("一段编译失败的坏程序", `const x = ;\nprint(x);`);

  console.log("\n=== 对比：同一个组合任务 ===");
  console.log(`                     ch42 · Tool Calling    ch43 · Code as Action`);
  console.log(`模型决策次数          5                      1`);
  console.log(`能力调用次数          4                      4（在同一段程序内）`);
  console.log(`Model↔Harness 往返     5                      1`);
  console.log(`进上下文的中间结果      4 份整文件内容           仅最终输出`);
  console.log("");
}

main();