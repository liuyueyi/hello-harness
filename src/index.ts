 import { createOpenAIModel } from "./model/openai";
import { systemMessage, userMessage } from "./messages";
import { calculator } from "./tool/calculator";
import { randomInteger } from "./tool/random";
import { ToolRegistry } from "./tool/registry";
import { AgentRuntime } from "./runtime";
import type { Model } from "./model/model";
import type { ModelRequest } from "./model/types";

const registry = new ToolRegistry();
registry.register(calculator);
registry.register(randomInteger);

async function runStream(model: Model, request: ModelRequest) {
  const startedAt = Date.now();
  let firstTokenAt: number | undefined;
  let inputTokens = 0;
  let outputTokens = 0;

  process.stdout.write("Output : ");
  for await (const event of model.stream(request)) {
    if (event.type === "content") {
      if (firstTokenAt === undefined) firstTokenAt = Date.now();
      process.stdout.write(event.text);
    } else if (event.type === "usage") {
      inputTokens = event.inputTokens;
      outputTokens = event.outputTokens;
    }
  }

  const elapsedMs = Date.now() - startedAt;
  const firstTokenMs = firstTokenAt === undefined ? 0 : firstTokenAt - startedAt;
  console.log("");
  console.log(`Model  : ${model.modelName} · ${elapsedMs}ms（首 token ${firstTokenMs}ms）· ${inputTokens} in / ${outputTokens} out`);
}

async function runGenerate(model: Model, request: ModelRequest) {
  const startedAt = Date.now();
  const response = await model.generate(request);
  const elapsedMs = Date.now() - startedAt;

  console.log(`Output : ${response.content}`);
  console.log(`Model  : ${model.modelName} · ${elapsedMs}ms（一次性）· ${response.inputTokens} in / ${response.outputTokens} out`);
}

async function runAgentDemo(model: Model, request: ModelRequest, options: { maxSteps?: number; timeoutMs?: number }) {
  const runtime = new AgentRuntime(model, registry, options);
  let stepCount = 0;

  runtime.on("run:start", (e) => {
    console.log(`Run ID  : ${e.runId}`);
    console.log(`Input   : ${e.input}`);
  });
  runtime.on("step", (e) => {
    stepCount += 1;
    const n = stepCount;
    const s = e.step;
    if (s.type === "model") {
      console.log(
        s.response.toolCalls.length > 0
          ? `Step ${n} · model  → 调用工具：${s.response.toolCalls.map((c) => c.name).join(", ")}`
          : `Step ${n} · model  → 完成回答`,
      );
    } else if (s.type === "tool") {
      const outcome = s.result.ok ? JSON.stringify(s.result.value) : `[${s.result.kind}] ${s.result.error}`;
      console.log(`Step ${n} · tool   → ${s.call.name}(${JSON.stringify(s.call.arguments)}) = ${outcome}`);
    } else if (s.type === "finish") {
      console.log(`Step ${n} · finish → ${s.stopReason}`);
    } else {
      console.log(`Step ${n} · error  → ${s.kind} (${s.stopReason}) ${s.message}`);
    }
  });

  const run = await runtime.run(request);
  const elapsedMs = run.endedAt - run.startedAt;

  console.log(`Answer  : ${run.answer}`);
  console.log(`Steps   : ${run.iterations} 轮 · ${run.history.length} 条消息 · ${stepCount} 步 · ${elapsedMs}ms`);
  console.log(`Status  : ${run.status} (${run.stopReason})${run.error ? ` · [${run.errorKind}] ${run.error}` : ""}`);
}

function parseArgs(args: string[]): {
  full: boolean;
  tools: boolean;
  maxSteps?: number;
  timeoutMs?: number;
  question?: string;
} {
  const result: {
    full: boolean;
    tools: boolean;
    maxSteps?: number;
    timeoutMs?: number;
  } = { full: false, tools: false };
  const positionals: string[] = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--full") {
      result.full = true;
    } else if (arg === "--tools") {
      result.tools = true;
    } else if (arg === "--steps" || arg === "--timeout") {
      const value = Number(args[++i]);
      if (arg === "--steps") result.maxSteps = value;
      else result.timeoutMs = value;
    } else {
      positionals.push(arg);
    }
  }

  return { ...result, question: positionals[0] };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const prompt = args.question ?? "用一句话介绍你自己";

  const request: ModelRequest = {
    messages: [systemMessage("你是一个简洁、直接的中文助手，工具可以使用时必须调用工具；对于复杂的数学计算，你应该拆分成多个简单的表达式，进行多次的工具调用"), userMessage(prompt)],
  };

  const model = createOpenAIModel();
  if (args.tools) {
    await runAgentDemo(model, request, { maxSteps: args.maxSteps, timeoutMs: args.timeoutMs });
  } else if (args.full) {
    await runGenerate(model, request);
  } else {
    await runStream(model, request);
  }
}

main().catch((error) => {
  console.error("调用失败：", error instanceof Error ? error.message : String(error));
  process.exit(1);
});