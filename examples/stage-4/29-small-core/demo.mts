import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  AgentRuntime,
  Session,
  ToolRegistry,
  systemMessage,
  type Model,
  type ModelResponse,
  type Tool,
  type ToolResult,
} from "@hello-harness/core";

const pkgsDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..", "packages");

function countLines(text: string): number {
  if (text === "") return 0;
  return text.split("\n").length;
}

interface CoreFile {
  rel: string;
  full: string;
  lines: number;
}

async function walkTs(dir: string, prefix: string): Promise<CoreFile[]> {
  const out: CoreFile[] = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    const rel = path.join(prefix, entry.name).split(path.sep).join("/");
    if (entry.isDirectory()) {
      out.push(...(await walkTs(full, rel)));
    } else if (entry.name.endsWith(".ts")) {
      out.push({ rel, full, lines: countLines(await readFile(full, "utf-8")) });
    }
  }
  return out;
}

async function printBoundaryReport(): Promise<void> {
  const coreDir = path.join(pkgsDir, "core", "src");
  const coreFiles = (await walkTs(coreDir, "core")).sort((a, b) => a.rel.localeCompare(b.rel));
  const outsideDirs = ["extensions", "coding", "cli", "ai"];

  let coreTotal = 0;
  for (const f of coreFiles) coreTotal += f.lines;

  const outsideFiles: CoreFile[] = [];
  for (const dir of outsideDirs) {
    outsideFiles.push(...(await walkTs(path.join(pkgsDir, dir, "src"), dir)));
  }
  outsideFiles.sort((a, b) => a.rel.localeCompare(b.rel));

  const thirdParty = new Set<string>();
  const depPattern = /from\s+["']([^"']+)["']/g;
  for (const f of coreFiles) {
    const text = await readFile(f.full, "utf-8");
    for (const m of text.matchAll(depPattern)) {
      const spec = m[1];
      if (!spec.startsWith(".") && !spec.startsWith("node:")) thirdParty.add(spec);
    }
  }

  console.log("=== Core 边界报告（packages/ 的文件数与行数） ===");
  console.log(`Core（packages/core/src/，共 ${coreFiles.length} 个文件，${coreTotal} 行）：`);
  for (const f of coreFiles) {
    console.log(`  ${f.rel.padEnd(22)} ${String(f.lines).padStart(4)} 行`);
  }
  console.log(`Core 之外（packages/{extensions,coding,cli,ai}，共 ${outsideFiles.length} 个文件，${outsideFiles.reduce((s, f) => s + f.lines, 0)} 行）：`);
  for (const f of outsideFiles) {
    console.log(`  ${f.rel}`);
  }
  const total = coreTotal + outsideFiles.reduce((s, f) => s + f.lines, 0);
  console.log(`\nCore 占比：约 ${Math.round((coreTotal / total) * 100)}%（${coreTotal} / ${total} 行）`);
  console.log(
    thirdParty.size === 0
      ? "Core 第三方依赖：无（只 import node 内置模块与 core 内部文件）"
      : `Core 第三方依赖：${[...thirdParty].join(", ")}`,
  );
}

async function runCoreOnlyAgent(): Promise<void> {
  console.log("\n=== 只用 Core（Model · Runtime · Context · Tool · Event · Session）跑一个多轮 Agent ===");

  const double: Tool = {
    name: "double",
    description: "把一个数字翻倍",
    parameters: {
      type: "object",
      properties: { n: { type: "number", description: "要翻倍的数字" } },
      required: ["n"],
    },
    async execute(input: unknown): Promise<ToolResult> {
      const { n } = input as { n?: unknown };
      if (typeof n !== "number") return { ok: false, error: "参数 n 必须是数字", kind: "tool", retryable: false };
      return { ok: true, value: n * 2 };
    },
  };

  const registry = new ToolRegistry();
  registry.register(double);

  const replies: ModelResponse[] = [
    { content: "", toolCalls: [{ id: "c1", name: "double", arguments: { n: 21 } }], inputTokens: 3, outputTokens: 2 },
    { content: "21 翻倍等于 42", toolCalls: [], inputTokens: 5, outputTokens: 6 },
    { content: "", toolCalls: [{ id: "c2", name: "double", arguments: { n: 42 } }], inputTokens: 9, outputTokens: 2 },
    { content: "42 再翻倍等于 84", toolCalls: [], inputTokens: 11, outputTokens: 6 },
  ];
  let index = 0;
  const model: Model = {
    modelName: "fake-core",
    async generate(): Promise<ModelResponse> {
      return replies[Math.min(index++, replies.length - 1)];
    },
    async *stream() {},
  };

  const runtime = new AgentRuntime(model, registry, { maxSteps: 5 });
  runtime.on("step", (e) => {
    const s = e.step;
    if (s.type === "model") {
      const names = s.response.toolCalls.map((c) => c.name).join(", ");
      console.log(`  [model ] 调用工具：${names || "（无，直接回答）"}`);
    } else if (s.type === "tool") {
      console.log(`  [tool  ] ${s.call.name}(${JSON.stringify(s.call.arguments)}) = ${JSON.stringify(s.result.value)}`);
    } else {
      console.log(`  [finish] ${s.stopReason}`);
    }
  });

  const session = new Session(undefined, [systemMessage("你是一个最小 Agent，只会用 double 工具。")]);

  const run1 = await session.turn(runtime, "21 翻倍是多少？");
  console.log(`  turn1 : ${run1.status} (${run1.stopReason}) · 答案：${run1.answer}？ · ${run1.steps.length} 步`);

  const run2 = await session.turn(runtime, "那再把结果翻倍一次呢？");
  console.log(`  turn2 : ${run2.status} (${run2.stopReason}) · 答案：${run2.answer}？ · ${run2.steps.length} 步`);

  console.log("\n  注意：这个循环只用到 packages/core/src 的 6 个抽象 ——");
  console.log("  Model · Runtime · Context · Tool · Event · Session");
  console.log("  没有任何 read/write/edit/bash、Workspace、CLI 参与，也能完整跑通两轮对话。");
}

async function main() {
  await printBoundaryReport();
  await runCoreOnlyAgent();
}

main();