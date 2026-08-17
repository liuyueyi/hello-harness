import { AgentRuntime } from "../../../src/core/runtime/runtime";
import { ToolRegistry } from "../../../src/core/tool/registry";
import { ModelError } from "../../../src/core/errors/errors";
import type { Model } from "../../../src/core/model/model";
import type { ModelResponse } from "../../../src/core/model/types";

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function fakeModel(script: (calls: number) => Promise<ModelResponse>): Model {
  let calls = 0;
  return {
    modelName: "fake",
    async generate(): Promise<ModelResponse> {
      calls += 1;
      return script(calls);
    },
    async *stream() {},
  };
}

async function main() {
  console.log("=== 1. 模型重试：第一次抛 ModelError，第二次成功 ===");
  {
    const model = fakeModel(async (calls) => {
      if (calls === 1) throw new ModelError("网络抖了一下");
      return { content: "重试后成功", toolCalls: [], inputTokens: 0, outputTokens: 0 };
    });
    const runtime = new AgentRuntime(model, new ToolRegistry(), { maxRetries: 2, retryBaseMs: 10 });
    runtime.on("model:retry", (e) => console.log(`  [model:retry] 第 ${e.attempt} 次重试：${e.error}`));
    const run = await runtime.run({ messages: [{ role: "user", content: "hi" }] });
    console.log(`  status=${run.status} (${run.stopReason}) answer=${run.answer}`);
  }

  console.log("=== 2. 工具超时：工具睡 200ms，toolTimeoutMs=50 ===");
  {
    const registry = new ToolRegistry();
    registry.register({
      name: "slow",
      description: "慢工具",
      parameters: { type: "object", properties: {}, required: [] },
      async execute() {
        await sleep(200);
        return { ok: true, value: 42 };
      },
    });
    const model = fakeModel(async (calls) => {
      if (calls === 1) return { content: "", toolCalls: [{ id: "c1", name: "slow", arguments: {} }], inputTokens: 0, outputTokens: 0 };
      return { content: "工具超时但任务完成", toolCalls: [], inputTokens: 0, outputTokens: 0 };
    });
    const runtime = new AgentRuntime(model, registry, { toolTimeoutMs: 50 });
    const run = await runtime.run({ messages: [{ role: "user", content: "go" }] });
    const toolStep = run.steps.find((s) => s.type === "tool");
    console.log(`  status=${run.status} (${run.stopReason}) tool=${JSON.stringify(toolStep?.result)}`);
  }

  console.log("=== 3. 中途取消：工具永不返回，100ms 后 abort() ===");
  {
    const registry = new ToolRegistry();
    registry.register({
      name: "hang",
      description: "挂起",
      parameters: { type: "object", properties: {}, required: [] },
      async execute() {
        return new Promise(() => {});
      },
    });
    const model = fakeModel(async (calls) => {
      if (calls === 1) return { content: "", toolCalls: [{ id: "c1", name: "hang", arguments: {} }], inputTokens: 0, outputTokens: 0 };
      return { content: "不该到达", toolCalls: [], inputTokens: 0, outputTokens: 0 };
    });
    const runtime = new AgentRuntime(model, registry);
    setTimeout(() => runtime.abort(), 100);
    const startedAt = Date.now();
    const run = await runtime.run({ messages: [{ role: "user", content: "go" }] });
    console.log(`  status=${run.status} (${run.stopReason}) error=${run.error} elapsed=${Date.now() - startedAt}ms`);
  }
}

main();