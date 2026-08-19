import { PromptLoader, PromptRegistry } from "@hello-harness/extensions";
import { ExtensionRegistry, defineExtension } from "@hello-harness/extensions";
import { AgentRuntime, HookManager, ToolRegistry, systemMessage, userMessage } from "@hello-harness/core";
import type { Model, ModelRequest, ModelResponse } from "@hello-harness/core";

function head(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

function recordingModel(seen: { system: string }): Model {
  return {
    modelName: "fake-prompt",
    async generate(request: ModelRequest): Promise<ModelResponse> {
      seen.system = request.messages.find((m) => m.role === "system")?.content ?? "";
      return { content: "（模型收到了 system prompt）", toolCalls: [], inputTokens: 1, outputTokens: 1 };
    },
    async *stream() {},
  };
}

async function main() {
  console.log("=== 33 · Prompt Extension：Prompt 不再写死 ===");

  console.log("\n=== 1. PromptLoader 从 prompts/ 目录加载 *.md ===");
  const loaded = new PromptLoader("prompts").loadSync();
  for (const prompt of loaded) {
    console.log(`  ${prompt.name}.md → name=${prompt.name} · ${prompt.content.length} 字符`);
  }

  console.log("\n=== 2. 扩展通过 ctx.prompts 注册（随扩展加载） ===");
  const registry = new ToolRegistry();
  const hooks = new HookManager();
  const prompts = new PromptRegistry();
  const extensions = new ExtensionRegistry({ tools: registry, hooks, prompts });
  extensions.install(
    defineExtension({
      name: "hello-coding",
      description: "把 prompts/*.md 注册为 prompt",
      setup(ctx) {
        for (const prompt of loaded) ctx.prompts.register(prompt);
      },
    }),
  );
  console.log(`  prompts.list() → ${prompts.list().map((p) => p.name).join(" / ")}`);

  console.log("\n=== 3. 同一个 Agent，换 prompt 文件，system 消息跟着换 ===");
  const seen: { system: string } = { system: "" };
  const runtime = new AgentRuntime(recordingModel(seen), registry, { hooks, maxSteps: 1 });
  const coding = prompts.get("coding")?.content ?? "";
  const review = prompts.get("review")?.content ?? "";

  await runtime.run({ messages: [systemMessage(coding), userMessage("看一下这个项目")] });
  console.log(`  用 coding  prompt → system 首行：「${head(seen.system.split("\n")[0], 40)}」`);
  await runtime.run({ messages: [systemMessage(review), userMessage("看一下这个项目")] });
  console.log(`  用 review  prompt → system 首行：「${head(seen.system.split("\n")[0], 40)}」`);

  console.log("\n=== 4. 未注册时兜底：get() 返回 undefined ===");
  const empty = new PromptRegistry();
  const fallback = empty.get("coding")?.content ?? "（默认提示词）";
  console.log(`  空 registry 取 coding → ${fallback}`);
}

main();