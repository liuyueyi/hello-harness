import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { AgentRuntime, ToolRegistry } from "@hello-harness/core";
import type { Model, ToolCall } from "@hello-harness/core";
import { systemMessage, userMessage } from "@hello-harness/core";
import { Workspace, createBashTool, createReadTool } from "@hello-harness/coding";

// 造一个临时工作区：3 个 TypeScript 文件，2 个包含 "AgentRuntime"，1 个不包含
const scratch = path.join(os.tmpdir(), "hello-harness-42-composition-demo");
rmSync(scratch, { recursive: true, force: true });
mkdirSync(path.join(scratch, "src"), { recursive: true });

function padSource(head: string, lines: number): string {
  const out = [...head.split("\n")];
  while (out.length < lines) out.push("// filler line");
  return out.join("\n") + "\n";
}

writeFileSync(
  path.join(scratch, "src", "AgentRunner.ts"),
  padSource(`// AgentRunner.ts\nimport { AgentRuntime } from "@hello-harness/core";\n\nexport function create(): AgentRuntime {\n  return new AgentRuntime(/* model, registry, options */);\n}\n`, 320),
  "utf-8",
);
writeFileSync(
  path.join(scratch, "src", "ToolRegistry.ts"),
  padSource(`// ToolRegistry.ts\nimport { AgentRuntime } from "@hello-harness/core";\n\nexport const runtimes: AgentRuntime[] = [];\n`, 12),
  "utf-8",
);
writeFileSync(
  path.join(scratch, "src", "utils.ts"),
  padSource(`// utils.ts\nexport const answer = 42;\n`, 5),
  "utf-8",
);

const workspace = new Workspace(scratch);
const registry = new ToolRegistry();
registry.register(createReadTool(workspace));
registry.register(createBashTool(workspace));

// 脚本化模型：一个 "组合任务"（列出文件 → 逐个读取确认 → 收尾）被拆成了 N 次模型决策
function createCompositionModel(): Model {
  const script: Array<{ content: string; toolCalls: ToolCall[] }> = [
    {
      content: "先列出 src 下所有 TypeScript 文件，看看有哪些文件需要确认。",
      toolCalls: [{ id: "c1", name: "bash", arguments: { command: "dir /b /s src\\*.ts" } }],
    },
    {
      content: "第一个文件可能是候选，读取它确认是否包含 AgentRuntime。",
      toolCalls: [{ id: "c2", name: "read", arguments: { path: "src/AgentRunner.ts" } }],
    },
    {
      content: "已确认包含 AgentRuntime，继续读下一个文件确认。",
      toolCalls: [{ id: "c3", name: "read", arguments: { path: "src/ToolRegistry.ts" } }],
    },
    {
      content: "也包含 AgentRuntime，继续读最后一个文件。",
      toolCalls: [{ id: "c4", name: "read", arguments: { path: "src/utils.ts" } }],
    },
    {
      content: "已完成全部确认：包含 AgentRuntime 的文件是 src/AgentRunner.ts 和 src/ToolRegistry.ts（utils.ts 不含）。",
      toolCalls: [],
    },
  ];
  let index = 0;
  return {
    modelName: "mock-roundtrip",
    async generate() {
      const item = script[Math.min(index++, script.length - 1)];
      return { content: item.content, toolCalls: item.toolCalls, inputTokens: 800, outputTokens: 350 };
    },
    async *stream() {
      throw new Error("本 demo 使用 generate 模式，不应调用 stream");
    },
  };
}

function summarize(value: unknown): string {
  if (typeof value === "string") {
    return value.length <= 50
      ? `content=${JSON.stringify(value)}`
      : `content=${JSON.stringify(value.slice(0, 50))}…（${value.length} 字符）`;
  }
  if (typeof value === "object" && value !== null) {
    const bash = value as { stdout?: string; exitCode?: number | null };
    if (typeof bash.stdout === "string") {
      const lines = bash.stdout.trim().split("\n").filter((l) => l.trim() !== "");
      return `stdout=${JSON.stringify(lines[0] ?? "")}…（${lines.length} 行）exitCode=${bash.exitCode}`;
    }
  }
  return JSON.stringify(value).slice(0, 80);
}

async function main() {
  console.log("=== 42 · Tool Calling 的组合成本：为什么 1 个组合任务要 5 次模型往返 ===\n");

  const runtime = new AgentRuntime(createCompositionModel(), registry, { maxSteps: 10 });

  runtime.on("model:end", (e) => {
    const calls = e.response.toolCalls
      .map((c) => `${c.name}(${JSON.stringify(c.arguments)})`)
      .join("，");
    const tail = calls ? ` → 决定调用：${calls}` : " → 无工具调用，可以收尾";
    console.log(`[模型] ${e.response.content.slice(0, 34)}${e.response.content.length > 34 ? "…" : ""}${tail}`);
  });
  runtime.on("tool:start", (e) => {
    console.log(`  [工具] → ${e.call.name}(${JSON.stringify(e.call.arguments)})`);
  });
  runtime.on("tool:end", (e) => {
    const result = e.result.ok ? summarize(e.result.value) : `失败 ${e.result.error}（${e.result.kind}）`;
    console.log(`  [结果] ← ${result}`);
  });

  const run = await runtime.run({
    messages: [
      systemMessage("你是一个严谨的 Coding Agent：确认任何事实前必须先调用工具查看真实内容，不要猜，也不要跳过。"),
      userMessage("找出 src 下所有包含「AgentRuntime」的 TypeScript 文件。请逐个用工具确认每个文件后再给出结论。"),
    ],
  });

  const toolSteps = run.steps.filter((s) => s.type === "tool").length;
  console.log("\n=== 组合成本度量 ===");
  console.log(`任务数量        : 1`);
  console.log(`模型决策次数    : ${run.iterations}（每次工具结果都要回到模型再做一次决定）`);
  console.log(`工具调用次数    : ${toolSteps}`);
  console.log(`模型↔Harness 往返 : ${run.iterations} 次`);
  console.log(`token          : ${run.inputTokens} in / ${run.outputTokens} out`);
  console.log(`最终回答        : ${run.answer}`);
  console.log("");
}

main();