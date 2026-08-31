import { createOpenAIModel } from "@hello-harness/ai";
import { systemMessage, userMessage } from "@hello-harness/core";
import { Workspace } from "@hello-harness/coding";
import { ToolRegistry } from "@hello-harness/core";
import { AgentRuntime } from "@hello-harness/core";
import { HookManager } from "@hello-harness/core";
import { PermissionGate } from "@hello-harness/core";
import type { AskResolver } from "@hello-harness/core";
import { createDefaultPermissionGate } from "@hello-harness/coding";
import { ExtensionRegistry, PackageLoader } from "@hello-harness/extensions";
import { createHelloCodingExtension } from "@hello-harness/coding";
import { createTraceHookExtension } from "@hello-harness/extensions";
import { PromptRegistry } from "@hello-harness/extensions";
import { SkillRegistry, MAX_SKILLS_LOADED } from "@hello-harness/extensions";
import { renderSkillCatalog, injectSkillCatalog } from "@hello-harness/extensions";
import type { AgentRuntimeOptions } from "@hello-harness/core";
import type { AgentRun } from "@hello-harness/core";
import type { Model } from "@hello-harness/core";
import type { ModelRequest } from "@hello-harness/core";
import type { DisplayState } from "./render";
import { subscribeEvents, printSummary } from "./render";
import { Tui } from "./tui";
import { chat } from "./chat";
import { runPi } from "./pi";
import { createInterface } from "node:readline/promises";

const DEFAULT_SYSTEM_PROMPT = `你是一个简洁、直接的中文 Coding Agent。面对代码任务时，必须遵循以下方法论干活：

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
- 复杂的数学计算应拆分成多个简单表达式，进行多次的工具调用。

【组合任务请写程序】
- 需要遍历、过滤、聚合，或把多次读取/查找组合完成的任务，不要逐个点工具——直接写一段 JavaScript 程序，一次调用 code 工具执行（循环、过滤、汇总都在程序内完成）；
- 程序里可调用的能力全部绑定到已注册工具，与直接点工具走同一套 ToolRegistry + 权限：glob(pattern)、read(path)、write(path, content)、edit(path, oldString, newString)、bash(command)；另有 require(id)（仅白名单内建模块：path / util / os）、cwd()（workspace 根目录）与 print(内容)（输出最终结论，只有 print 出的内容会进入下一轮上下文）；
- glob 与 read 只能访问 workspace 内的路径，不要尝试越界；require 只加载白名单内建模块（path / util / os），fs / child_process 等一律被拒绝，不要尝试绕过；
- 拼绝对路径用注入的 cwd()，不要依赖 process.cwd()（CLI 的启动目录可能不是 workspace 根）；
- 不要在程序里写 import 语句（本执行面是函数作用域），需要模块用 require；
- 程序不要带 \`\`\` 围栏（会自动剥离）；中间结果保留在程序变量里，不要逐条回显；最终只用 print 输出结论；
- 程序里的 write / edit / bash 会触发权限确认（被拒绝时错误消息会说明原因），只读的 glob / read 直接放行。`;

function createAgent(
  dir: string,
  options: { traceHook?: boolean; permission?: "default" | "auto" | "off" } = {},
): {
  workspace: Workspace;
  registry: ToolRegistry;
  extensions: ExtensionRegistry;
  hooks: HookManager;
  prompts: PromptRegistry;
  skills: SkillRegistry;
  gate?: PermissionGate;
} {
  const workspace = new Workspace(dir);
  const registry = new ToolRegistry();
  const hooks = new HookManager();
  const prompts = new PromptRegistry();
  const skills = new SkillRegistry();
  const extensions = new ExtensionRegistry({ tools: registry, hooks, prompts, skills });
  let gate: PermissionGate | undefined;
  if (options.permission !== "off") {
    gate = createDefaultPermissionGate();
    if (options.permission === "auto") {
      gate.setAsk(async () => true);
    }
    registry.attachGate(gate);
  }
  extensions.install(createHelloCodingExtension(workspace));
  if (options.traceHook) {
    extensions.install(createTraceHookExtension());
  }
  return { workspace, registry, extensions, hooks, prompts, skills, gate };
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
  options: AgentRuntimeOptions & { streaming?: boolean; tui?: boolean },
): Promise<AgentRun> {
  const runtime = new AgentRuntime(model, registry, options);
  const state: DisplayState = { stepCount: 0, retryCount: 0 };
  const tui = options.tui ? new Tui() : undefined;

  process.once("SIGINT", () => {
    console.log("");
    console.log("收到 Ctrl+C，正在取消运行…");
    runtime.abort();
  });

  if (tui) {
    tui.attach(runtime);
  } else {
    subscribeEvents(runtime, state, options.streaming ?? false);
  }

  const run = await runtime.run(request);
  if (tui) {
    tui.detach();
    console.log(tui.snapshot());
  }
  printSummary(run, state);
  return run;
}

function createInteractiveAskResolver(): AskResolver {
  return async (call, reason) => {
    if (!process.stdin.isTTY) return false;
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    try {
      const answer = await rl.question(
        `[权限] 模型请求调用 ${call.name}：${reason}\n  参数：${JSON.stringify(call.arguments)}\n  允许执行？(y/N) > `,
      );
      return /^(y|yes|allow|允许|1)$/i.test(answer.trim());
    } finally {
      rl.close();
    }
  };
}

interface CliArgs {
  full: boolean;
  tools: boolean;
  chat: boolean;
  stream: boolean;
  extensions: boolean;
  prompts: boolean;
  skills: boolean;
  permissions: boolean;
  traceHook: boolean;
  permission?: "default" | "auto" | "off";
  packages: string[];
  tui: boolean;
  pi: boolean;
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
  const result: CliArgs = { full: false, tools: false, chat: false, stream: false, extensions: false, prompts: false, skills: false, permissions: false, traceHook: false, packages: [], tui: false, pi: false, help: false };
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
    } else if (arg === "--prompts") {
      result.prompts = true;
    } else if (arg === "--skills") {
      result.skills = true;
    } else if (arg === "--permissions") {
      result.permissions = true;
    } else if (arg === "--auto-approve") {
      result.permission = "auto";
    } else if (arg === "--no-permissions") {
      result.permission = "off";
    } else if (arg === "--trace-hook") {
      result.traceHook = true;
    } else if (arg === "--no-trace-hook") {
      result.traceHook = false;
    } else if (arg === "--tui") {
      result.tui = true;
    } else if (arg === "--pi") {
      result.pi = true;
    } else if (arg === "--help" || arg === "-h") {
      result.help = true;
    } else if (arg === "--package" || arg === "-p") {
      result.packages.push(args[++i]);
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
  hipi                                        直接进入 Pi 风格交互 TUI（已注册常用工具）
  hipi "帮我修复这个项目"                    直接进入 Pi 风格交互 TUI（问题可随后输入）
  hello --dir <项目目录> "帮我修复这个项目"     打开指定项目目录并运行
  hello --chat                              多轮对话（逐行）
  hello --chat --tui                        多轮对话 + 每轮跑动进面板屏
  hello --resume <会话id>                    继续一场历史会话
  hello --extensions                        列出已安装的扩展
  hello --package <目录>                     从磁盘加载独立扩展包（可重复）
  hello --tui "问题"                          TUI 面板模式运行 Coding Agent
  hello --stream "问题"                      纯流式对话（无工具）
  hello --full "问题"                        一次性生成（无工具）

参数:
  --dir <路径> / -d <路径>  指定 workspace 根目录（默认当前目录）
  --pi                     显式进入 Pi 风格交互 TUI（无参数时默认即是）
  --tools                  工具模式（单次运行）
  --chat                   多轮对话模式
  --resume <id>            继续历史会话（从 .sessions/ 载入）
  --extensions             列出已安装的扩展
  --package <目录> / -p <目录>  从磁盘加载独立扩展包（读取 package.json，默认入口 index.ts）
  --prompts                列出已注册的提示词（prompt）
  --skills                 列出已加载的技能（skill）
  --permissions            列出已安装的权限策略（policy）
  --auto-approve           权限门遇到 ask 时自动批准（非交互）
  --no-permissions         关闭权限门（默认开启：allow / deny / ask）
  --trace-hook             开启 trace-hook 扩展：打印 6 个 hook 节点的运行轨迹
  --no-trace-hook          关闭 trace-hook 扩展（默认即关闭）
  --tui                    面板模式：thinking / tool call / tool result / diff / token 一屏看全（--chat 时每轮一屏）
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

  const { workspace, registry, extensions, hooks, prompts, skills, gate } = createAgent(args.dir ?? process.cwd(), {
    traceHook: args.traceHook,
    permission: args.permission,
  });

  const loader = new PackageLoader((message) => console.log(`[pkg] ${message}`));
  for (const dir of args.packages) {
    const pkg = await loader.load(dir, workspace);
    extensions.install(pkg.extension);
  }

  if (args.extensions) {
    console.log(`Workspace: ${workspace.root}`);
    console.log("已安装扩展（manifest）：");
    for (const ext of extensions.list()) {
      console.log(`  ${ext.name}@${ext.version ?? "-"} (${ext.status}) — ${ext.description ?? ""}`);
    }
    return;
  }

  if (args.prompts) {
    console.log(`Workspace: ${workspace.root}`);
    console.log("已注册的提示词（prompt）：");
    for (const prompt of prompts.list()) {
      const firstLine = prompt.content.split("\n").find((line) => line.trim() !== "") ?? "";
      console.log(`  ${prompt.name}（${prompt.content.length} 字符）`);
      console.log(`    ↳ ${firstLine.slice(0, 60)}`);
    }
    return;
  }

  if (args.skills) {
    console.log(`Workspace: ${workspace.root}`);
    console.log("已加载的技能（skill）：");
    for (const skill of skills.list()) {
      const scripts = skill.scripts?.length ?? 0;
      const references = skill.references?.length ?? 0;
      const assets = skill.assets?.length ?? 0;
      console.log(`  ${skill.name} · ${skill.description}`);
      console.log(`    ↳ scripts ${scripts} 个 · references ${references} 个 · assets ${assets} 个`);
    }
    return;
  }

  if (args.permissions) {
    console.log(`Workspace: ${workspace.root}`);
    console.log("已安装的权限策略（policy）：");
    if (!gate) {
      console.log("  （权限门未启用：--no-permissions）");
    } else {
      for (const policy of gate.list()) {
        console.log(`  ${policy.name} · ${policy.description}`);
      }
    }
    return;
  }

  const baseSystemPrompt = prompts.get("coding")?.content ?? DEFAULT_SYSTEM_PROMPT;
  const skillCatalog = renderSkillCatalog(skills.list());
  const systemPrompt = injectSkillCatalog(baseSystemPrompt, skillCatalog);
  if (skillCatalog !== "") {
    console.log(`可用技能：${skills.list().map((s) => s.name).join(" / ")} · 正文经 load_skill 按需加载（上限 ${MAX_SKILLS_LOADED} 个）`);
  }

  const wantsPi =
    args.pi ||
    (!args.question &&
      !args.chat &&
      !args.tools &&
      !args.stream &&
      !args.full &&
      !args.extensions &&
      !args.prompts &&
      !args.skills &&
      !args.permissions);
  if (wantsPi) {
    const model = createOpenAIModel();
    const options: AgentRuntimeOptions = {
      maxSteps: args.maxSteps,
      timeoutMs: args.timeoutMs,
      modelTimeoutMs: args.modelTimeoutMs,
      toolTimeoutMs: args.toolTimeoutMs,
      maxRetries: args.maxRetries,
      hooks,
    };
    await runPi({
      model,
      workspace,
      registry,
      hooks,
      gate,
      systemPrompt,
      options,
      confirmTools: args.permission !== "auto" && args.permission !== "off",
    });
    return;
  }

  const prompt = args.question ?? "用一句话介绍你自己";

  const request: ModelRequest = {
    messages: [systemMessage(systemPrompt), userMessage(prompt)],
  };

  const model = createOpenAIModel();
  const options: AgentRuntimeOptions = {
    maxSteps: args.maxSteps,
    timeoutMs: args.timeoutMs,
    modelTimeoutMs: args.modelTimeoutMs,
    toolTimeoutMs: args.toolTimeoutMs,
    maxRetries: args.maxRetries,
    hooks,
  };

  if (args.chat || args.resume) {
    if (gate && args.permission !== "auto") {
      gate.setAsk(createInteractiveAskResolver());
    }
    await chat(model, registry, systemPrompt, workspace, options, args.resume, args.tui);
  } else if (args.tools) {
    if (gate && args.permission !== "auto") {
      gate.setAsk(createInteractiveAskResolver());
    }
    console.log(`Workspace: ${workspace.root}`);
    await runAgentDemo(model, registry, request, { ...options, streaming: args.tui ? true : args.stream, tui: args.tui });
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