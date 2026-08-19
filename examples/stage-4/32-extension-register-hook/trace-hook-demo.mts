import { ExtensionRegistry, createTraceHookExtension } from "@hello-harness/extensions";
import { AgentRuntime, HookManager, ToolRegistry, userMessage } from "@hello-harness/core";
import type { Model, ModelResponse, Tool, ToolResult } from "@hello-harness/core";

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

function createFakeModel(): Model {
  const replies: ModelResponse[] = [
    { content: "", toolCalls: [{ id: "c1", name: "double", arguments: { n: 21 } }], inputTokens: 3, outputTokens: 2 },
    { content: "21 翻倍等于 42", toolCalls: [], inputTokens: 5, outputTokens: 4 },
  ];
  let index = 0;
  return {
    modelName: "fake-hook",
    async generate(): Promise<ModelResponse> {
      return replies[Math.min(index++, replies.length - 1)];
    },
    async *stream() {},
  };
}

async function main() {
  console.log("=== trace-hook 扩展：CLI 可开关的 Hook 轨迹 ===");

  console.log("\n=== 1. 安装 trace-hook（等价于 CLI 的 --trace-hook）后运行 ===");
  const registry = new ToolRegistry();
  registry.register(double);
  const hooks = new HookManager();
  const extensions = new ExtensionRegistry({ tools: registry, hooks });
  extensions.install(createTraceHookExtension());
  const runtime = new AgentRuntime(createFakeModel(), registry, { hooks, maxSteps: 5 });
  const run = await runtime.run({ messages: [userMessage("21 翻倍是多少？")] });
  console.log(`run 结果：${run.status} / ${run.stopReason} · 答案「${run.answer}」`);

  console.log("\n=== 2. 不安装 trace-hook（默认关闭）运行 ===");
  const plain = new AgentRuntime(createFakeModel(), registry, { maxSteps: 5 });
  const plainRun = await plain.run({ messages: [userMessage("21 翻倍是多少？")] });
  console.log(`run 结果：${plainRun.status} / ${plainRun.stopReason} · 答案「${plainRun.answer}」`);
}

main();