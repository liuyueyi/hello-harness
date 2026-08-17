import { createOpenAIModel } from "../providers/openai";
import { systemMessage, userMessage } from "../core/model/messages";
import { calculator } from "../tools/calculator";
import { randomInteger } from "../tools/random";
import { createReadTool } from "../tools/read";
import { createWriteTool } from "../tools/write";
import { createEditTool } from "../tools/edit";
import { createBashTool } from "../tools/bash";
import { Workspace } from "../workspace/workspace";
import { ToolRegistry } from "../core/tool/registry";
import { AgentRuntime } from "../core/runtime/runtime";
import { ExtensionRegistry, defineExtension } from "../extensions";
import type { AgentRun } from "../core/runtime/run";
import type { Model } from "../core/model/model";
import type { ModelRequest } from "../core/model/types";
import type { DisplayState } from "./render";
import { subscribeEvents, printSummary } from "./render";
import { chat } from "./chat";

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

const helloCoding = defineExtension({
  name: "hello-coding",
  version: "0.3.0",
  description: "Coding Agent 本体：工具四件套（read/write/edit/bash）+ 方法论 prompt。本章只立身份，工具与 prompt 分别于 ch31 / ch33 迁入。",
  setup() {},
});

function createAgent(dir: string): { workspace: Workspace; registry: ToolRegistry; extensions: ExtensionRegistry } {
  const workspace = new Workspace(dir);
  const registry = new ToolRegistry();
  registry.register(calculator);
  registry.register(randomInteger);
  registry.register(createReadTool(workspace));
  registry.register(createWriteTool(workspace));
  registry.register(createEditTool(workspace));
  registry.register(createBashTool(workspace));
  const extensions = new ExtensionRegistry({ log: () => {} });
  extensions.install(helloCoding);
  return { workspace, registry, extensions };
}

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
  registry: ToolRegistry,
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

interface CliArgs {
  full: boolean;
  tools: boolean;
  chat: boolean;
  stream: boolean;
  extensions: boolean;
  help: boolean;
  dir?: string;
  maxSteps?: number;
  timeoutMs?: number;
  modelTimeoutMs?: number;
  toolTimeoutMs?: number;
  maxRetries?: number;
  resume?: string;
  question?: string;
}

function parseArgs(args: string[]): CliArgs {
  const result: CliArgs = { full: false, tools: false, chat: false, stream: false, extensions: false, help: false };
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
    } else if (arg === "--extensions") {
      result.extensions = true;
    } else if (arg === "--help" || arg === "-h") {
      result.help = true;
    } else if (arg === "--dir" || arg === "-d") {
      result.dir = args[++i];
    } else if (arg === "--resume") {
      result.resume = args[++i];
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

function printUsage(): void {
  console.log(`hello · Hello Coding Agent CLI

用法:
  hello "帮我修复这个项目"                    在当前目录运行 Coding Agent（默认工具模式）
  hello --dir <项目目录> "帮我修复这个项目"     打开指定项目目录并运行 Coding Agent
  hello --chat                              多轮对话
  hello --resume <会话id>                    继续一场历史会话
  hello --extensions                        列出已安装扩展
  hello --stream "问题"                      纯流式对话（无工具）
  hello --full "问题"                        一次性生成（无工具）

参数:
  --dir <路径> / -d <路径>  指定 workspace 根目录（默认当前目录）
  --tools                  工具模式（默认开启）
  --chat                   多轮对话模式
  --resume <id>            继续历史会话（从 .sessions/ 载入）
  --extensions             列出已安装的扩展
  --stream                 流式对话模式（无工具）
  --full                   一次性生成模式（无工具）
  --steps <n>              最大迭代轮数
  --timeout <ms>           总超时
  --model-timeout <ms>     单次模型调用超时
  --tool-timeout <ms>      单次工具调用超时
  --retries <n>            模型调用重试次数
  -h / --help              显示帮助`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printUsage();
    return;
  }

  const { workspace, registry, extensions } = createAgent(args.dir ?? process.cwd());

  if (args.extensions) {
    console.log(`Workspace: ${workspace.root}`);
    console.log("已安装扩展（manifest）：");
    for (const ext of extensions.list()) {
      console.log(`  ${ext.name}@${ext.version ?? "-"} (${ext.status}) — ${ext.description ?? ""}`);
    }
    return;
  }

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

  if (args.chat || args.resume) {
    await chat(model, registry, SYSTEM_PROMPT, workspace, options, args.resume);
  } else if (args.tools) {
    console.log(`Workspace: ${workspace.root}`);
    await runAgentDemo(model, registry, request, { ...options, streaming: args.stream });
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