import { ExtensionRegistry, defineExtension } from "@hello-harness/extensions";
import { AgentRuntime, HookManager, ToolRegistry, systemMessage, userMessage } from "@hello-harness/core";
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
  console.log("=== 32 · Extension 注册 Hook：在运行中插手 ===");

  console.log("\n=== 1. 定义扩展：setup 里用 ctx.hooks.register ===");
  const helloTrace = defineExtension({
    name: "hello-trace",
    version: "0.1.0",
    description: "演示扩展：在 6 个运行节点各挂一个钩子",
    setup(ctx) {
      ctx.hooks.register("beforeRun", (e) => ctx.log(`beforeRun   run 开始 · 输入「${e.input}」`));
      ctx.hooks.register("beforeModel", (e) => {
        e.request.messages.push(systemMessage("【钩子注入】按章法干活，先观察再修改。"));
        ctx.log(`beforeModel 注入系统消息，请求现有 ${e.request.messages.length} 条消息`);
      });
      ctx.hooks.register("afterModel", (e) => ctx.log(`afterModel  模型返回 ${e.response.toolCalls.length} 个工具调用`));
      ctx.hooks.register("beforeTool", (e) => ctx.log(`beforeTool  即将执行 ${e.call.name}`));
      ctx.hooks.register("afterTool", (e) => ctx.log(`afterTool   ${e.call.name} → ok=${e.result.ok}`));
      ctx.hooks.register("afterRun", (e) => ctx.log(`afterRun    run 结束 · ${e.run.status} / ${e.run.stopReason}`));
    },
  });

  const registry = new ToolRegistry();
  registry.register(double);
  const hooks = new HookManager();
  const extensions = new ExtensionRegistry({ tools: registry, hooks });

  console.log("\n=== 2. 安装 + 跑一个会调用工具的 Agent ===");
  extensions.install(helloTrace);
  console.log("install(hello-trace) 完成（hooks 已接进 runtime）");
  const runtime = new AgentRuntime(createFakeModel(), registry, { hooks, maxSteps: 5 });
  const run = await runtime.run({ messages: [userMessage("21 翻倍是多少？")] });
  console.log(`run 结果：${run.status} / ${run.stopReason} · 答案「${run.answer}」`);

  console.log("\n=== 3. 没有 hooks 的 runtime 依然照常跑 ===");
  const plain = new AgentRuntime(createFakeModel(), registry, { maxSteps: 5 });
  const plainRun = await plain.run({ messages: [userMessage("21 翻倍是多少？")] });
  console.log(`run 结果：${plainRun.status} / ${plainRun.stopReason} · 答案「${plainRun.answer}」`);
}

main();