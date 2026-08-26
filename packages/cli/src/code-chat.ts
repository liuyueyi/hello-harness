import readline from "node:readline";
import {
  AgentRuntime,
  RuntimeError,
  Session,
  systemMessage,
  ToolRegistry,
} from "@hello-harness/core";
import type { Model } from "@hello-harness/core";
import type { Workspace } from "@hello-harness/coding";
import { createCodingCapabilities } from "@hello-harness/coding";
import type { RuntimeLanguage } from "@hello-harness/code-runtime";
import { createCodeActionTool } from "@hello-harness/code-runtime";
import { SessionStore } from "./session/store";

export interface CodeChatOptions {
  language: RuntimeLanguage;
  modelTimeoutMs?: number;
  codeTimeoutMs?: number;
  /** 是否启用标准 Coding Capability（fs + shell），默认 false。 */
  capabilities?: boolean;
}

function codeSystemPrompt(language: RuntimeLanguage, hasCapabilities: boolean): string {
  const isPython = language === "python";
  const languageLabel = isPython ? "Python" : language === "typescript" ? "TypeScript" : "JavaScript";
  const printName = isPython ? "print" : "console.log";

  const capNote = hasCapabilities
    ? `可用 Capability：通过 code_action 工具的 fs (read/write/list)、shell (run) 使用；这些能力受 workspace 路径限制与权限门保护，越界或被拒绝时会抛出结构化错误。`
    : "没有文件、网络、Shell、环境变量或任何外部 Capability；可用标准内存计算。";

  return `你是一个 Code Action Agent。请使用 code_action 工具来“行动”：把你的思考写成 ${languageLabel} 代码，调用 code_action({ code }) 执行。

运行环境只有 ${printName} 以及标准内存计算能力；${capNote}

要求：
- 用代码完成用户的问题；可使用变量、函数、循环、条件（${languageLabel} 支持的 async 也可按需使用）；
- 用 ${printName} 输出面向用户的简洁结论；
- 用 return 返回结构化结果；
- 当 code_action 返回 RuntimeResult 时，把它视作一段代码执行的观察，并据此继续或修正；
- 当你已经得到答案时，停止调用工具，用自然语言向用户总结结论；
- 不要尝试访问不存在的环境能力。`;
}

async function createOrResumeSession(store: SessionStore, language: RuntimeLanguage, resumeId?: string, hasCapabilities = false): Promise<Session> {
  if (!resumeId) return new Session(undefined, [systemMessage(codeSystemPrompt(language, hasCapabilities))]);
  const record = await store.load(resumeId);
  if (!record) throw new Error(`没有找到 Code Runtime 会话 ${resumeId}，请检查 .code-sessions/ 目录`);
  // If resuming, we keep the original session (with its system prompt).
  // Warn if capabilities setting differs from saved session.
  const savedHasCapabilities = record.context.messages[0]?.content?.includes("Capability") ?? false;
  if (hasCapabilities !== savedHasCapabilities) {
    console.log(`⚠ 恢复会话时的能力设置与保存时不同（保存时: ${savedHasCapabilities ? "开启" : "关闭"}，当前: ${hasCapabilities ? "开启" : "关闭"}），将沿用会话原有设置`);
  }
  const session = new Session(record.id, [...record.context.messages]);
  return session;
}

/** 以“模型 → code_action 工具 → CodeRuntime 执行”运行的交互式 Code Action 聊天（流式输出）。 */
export async function codeChat(
  model: Model,
  workspace: Workspace,
  options: CodeChatOptions,
  resumeId?: string,
): Promise<void> {
  const hasCapabilities = options.capabilities === true;
  const capabilities = hasCapabilities ? createCodingCapabilities(workspace) : undefined;

  const registry = new ToolRegistry();
  registry.register(
    createCodeActionTool(options.language, {
      timeoutMs: options.codeTimeoutMs,
      capabilities,
    }),
  );

  const runtime = new AgentRuntime(model, registry, {
    streaming: true,
    modelTimeoutMs: options.modelTimeoutMs,
    toolTimeoutMs: options.codeTimeoutMs,
  });

  const store = new SessionStore(workspace, ".code-sessions");
  const session = await createOrResumeSession(store, options.language, resumeId, hasCapabilities);
  let controller = new AbortController();

  process.on("SIGINT", () => {
    controller.abort();
    runtime.abort();
    console.log("\n收到 Ctrl+C，正在取消本轮运行…");
  });

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: !!process.stdin.isTTY });
  const buffer: string[] = [];
  let pending: ((value: string | null) => void) | null = null;
  let closed = false;
  rl.setPrompt("你 > ");
  rl.on("line", (line) => {
    if (pending) {
      pending(line);
      pending = null;
    } else {
      buffer.push(line);
    }
  });
  rl.on("close", () => {
    closed = true;
    pending?.(null);
    pending = null;
  });

  const ask = (prompt = "你 > ") =>
    new Promise<string | null>((resolve) => {
      if (buffer.length > 0) {
        resolve(buffer.shift()!);
        return;
      }
      if (closed) {
        resolve(null);
        return;
      }
      pending = resolve;
      rl.setPrompt(prompt);
      rl.prompt();
    });

  // Subscribe to AgentRuntime events for streaming output
  runtime.on("model:delta", ({ text }) => {
    process.stdout.write(text);
  });
  runtime.on("model:end", ({ response, durationMs }) => {
    console.log(`\n[model:end ] ${model.modelName} · ${response.inputTokens} in / ${response.outputTokens} out · ${durationMs}ms`);
  });
  runtime.on("tool:start", ({ call }) => {
    const code =
      call.arguments && typeof call.arguments === "object" && "code" in call.arguments
        ? String((call.arguments as Record<string, unknown>).code ?? "")
        : JSON.stringify(call.arguments);
    console.log(`\n--- Code Action (${options.language}) ---`);
    console.log(code || "（模型没有返回代码）");
  });
  runtime.on("tool:end", ({ result, durationMs }) => {
    console.log(`--- RuntimeResult (${durationMs}ms) ---`);
    console.log(JSON.stringify("value" in result ? result.value : result, null, 2));
  });
  runtime.on("run:end", ({ status, durationMs }) => {
    if (status === "aborted") {
      console.log(`\n[run:aborted] ${durationMs}ms`);
    }
  });

  console.log("");
  console.log(`Hello Harness · Code Action Chat (${options.language})（输入 exit 退出，Ctrl+C 取消运行）`);
  const runtimeLabel = options.language === "python" ? "Python 子进程（最小内存环境）" : "Node vm + 最小 console";
  const capLabel = hasCapabilities ? " + Capability (fs, shell)" : "";
  console.log(`Runtime : ${runtimeLabel}${capLabel}`);
  console.log(`Sessions: ${workspace.root}/.code-sessions`);
  console.log(resumeId ? `Resumed : ${session.id}` : `Session : ${session.id}`);

  for (;;) {
    const prompt = await ask();
    if (prompt === null || prompt.trim() === "" || prompt === "exit" || prompt === "quit") break;

    if (controller.signal.aborted) controller = new AbortController();

    try {
      await session.turn(runtime, prompt);
    } catch (error) {
      if (error instanceof RuntimeError && error.message === "任务已被取消") {
        continue;
      }
      console.log(`\n[error] ${error instanceof Error ? error.message : String(error)}`);
      continue;
    }

    await store.save(session.snapshot());
  }

  rl.close();
}
