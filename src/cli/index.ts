import { createOpenAIModel } from "../model/openai";
import { systemMessage, userMessage } from "../model/messages";
import { calculator } from "../tools/calculator";
import { randomInteger } from "../tools/random";
import { createReadTool } from "../tools/read";
import { createWriteTool } from "../tools/write";
import { createEditTool } from "../tools/edit";
import { createBashTool } from "../tools/bash";
import { Workspace } from "../workspace/workspace";
import { ToolRegistry } from "../tools/registry";
import { AgentRuntime } from "../agent/runtime";
import type { AgentRun } from "../agent/run";
import type { Model } from "../model/model";
import type { ModelRequest } from "../model/types";
import type { DisplayState } from "./render";
import { subscribeEvents, printSummary } from "./render";
import { chat } from "./chat";

const workspace = new Workspace(process.cwd());
const registry = new ToolRegistry();
registry.register(calculator);
registry.register(randomInteger);
registry.register(createReadTool(workspace));
registry.register(createWriteTool(workspace));
registry.register(createEditTool(workspace));
registry.register(createBashTool(workspace));

const SYSTEM_PROMPT = `你是一个简洁、直接的中文 Coding Agent。面对代码任务时，必须遵循以下方法论干活：

【先观察】
- 动手前先看清现状：涉及代码或文件时，先用 read 读取真实内容再回答，不要猜文件内容；
- 需要查看目录结构或定位文件时，用 bash（如 dir / ls / find）观察现场。

【再修改】
- 创建新文件或整文件重写时，用 write 写入完整内容，不要直接编造结果；
- 只修改文件中的一小段时，优先用 edit 做精准替换，而不是用 write 重写整个文件。

【修改后验证】
- 改完必须验证：用 bash 执行命令（如 node、npm test）跑一遍，基于 stdout / stderr / exitCode 判断结果，不通过就继续修。

【工具总则】
- 工具可以使用时必须调用工具；
- 复杂的数学计算应拆分成多个简单表达式，进行多次的工具调用。`;

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

async function runAgentDemo(
  model: Model,
  request: ModelRequest,
  options: {
    maxSteps?: number;
    timeoutMs?: number;
    modelTimeoutMs?: number;
    toolTimeoutMs?: number;
    maxRetries?: number;
    streaming?: boolean;
  },
): Promise<AgentRun> {
  const runtime = new AgentRuntime(model, registry, options);
  const state: DisplayState = { stepCount: 0, retryCount: 0 };

  process.once("SIGINT", () => {
    console.log("");
    console.log("收到 Ctrl+C，正在取消运行…");
    runtime.abort();
  });

  subscribeEvents(runtime, state, options.streaming ?? false);

  const run = await runtime.run(request);
  printSummary(run, state);
  return run;
}

function parseArgs(args: string[]): {
  full: boolean;
  tools: boolean;
  chat: boolean;
  stream: boolean;
  maxSteps?: number;
  timeoutMs?: number;
  modelTimeoutMs?: number;
  toolTimeoutMs?: number;
  maxRetries?: number;
  question?: string;
} {
  const result: {
    full: boolean;
    tools: boolean;
    chat: boolean;
    stream: boolean;
    maxSteps?: number;
    timeoutMs?: number;
    modelTimeoutMs?: number;
    toolTimeoutMs?: number;
    maxRetries?: number;
  } = { full: false, tools: false, chat: false, stream: false };
  const positionals: string[] = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--full") {
      result.full = true;
    } else if (arg === "--tools") {
      result.tools = true;
    } else if (arg === "--chat") {
      result.chat = true;
    } else if (arg === "--stream") {
      result.stream = true;
    } else if (arg === "--steps" || arg === "--timeout" || arg === "--model-timeout" || arg === "--tool-timeout" || arg === "--retries") {
      const value = Number(args[++i]);
      if (arg === "--steps") result.maxSteps = value;
      else if (arg === "--timeout") result.timeoutMs = value;
      else if (arg === "--model-timeout") result.modelTimeoutMs = value;
      else if (arg === "--tool-timeout") result.toolTimeoutMs = value;
      else result.maxRetries = value;
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
    messages: [systemMessage(SYSTEM_PROMPT), userMessage(prompt)],
  };

  const model = createOpenAIModel();
  const options = {
    maxSteps: args.maxSteps,
    timeoutMs: args.timeoutMs,
    modelTimeoutMs: args.modelTimeoutMs,
    toolTimeoutMs: args.toolTimeoutMs,
    maxRetries: args.maxRetries,
  };

  if (args.chat) {
    await chat(model, registry, options);
  } else if (args.tools) {
    await runAgentDemo(model, request, { ...options, streaming: args.stream });
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