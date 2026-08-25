import readline from "node:readline";
import {
  assistantMessage,
  RuntimeError,
  Session,
  systemMessage,
  userMessage,
  withGuard,
} from "@hello-harness/core";
import type { Model } from "@hello-harness/core";
import type { RuntimeLanguage, RuntimeResult } from "@hello-harness/code-runtime";
import { createCodeRuntime } from "@hello-harness/code-runtime";
import type { Workspace } from "@hello-harness/coding";
import { SessionStore } from "./session/store";

export interface CodeChatOptions {
  language: RuntimeLanguage;
  modelTimeoutMs?: number;
  codeTimeoutMs?: number;
}

function extractCode(content: string): string {
  const trimmed = content.trim();
  const fenced = trimmed.match(/^```(?:typescript|ts|javascript|js)?\s*\n([\s\S]*?)\n```$/i);
  return (fenced?.[1] ?? trimmed).trim();
}

function runtimeObservation(code: string, result: RuntimeResult): string {
  return [
    "[Code Action 已执行]",
    code,
    "",
    "[RuntimeResult]",
    JSON.stringify(result),
  ].join("\n");
}

function codeSystemPrompt(language: RuntimeLanguage): string {
  const isPython = language === "python";
  const languageLabel = isPython ? "Python" : language === "typescript" ? "TypeScript" : "JavaScript";
  const printName = isPython ? "print" : "console.log";
  const envNote = isPython
    ? "没有 process、文件、网络、Shell、环境变量或任何外部 Capability；可用标准 Python 内存计算。"
    : "没有 process、require、Buffer、文件、网络、Shell、环境变量或任何外部 Capability。";
  return `你是一个 Code Action Agent。每一轮都必须只输出一段可直接执行的 ${languageLabel} 代码：不要 Markdown 围栏、不要解释、不要 import 或 export。

运行环境只有 ${printName} 以及标准内存计算能力；${envNote}

要求：
- 用代码完成用户的问题；可使用变量、函数、循环、条件（${languageLabel} 支持的 async 也可按需使用）；
- 用 ${printName} 输出面向用户的简洁结论；
- 用 return 返回结构化结果；
- 若上轮 assistant 消息带有 [RuntimeResult]，把它视作上一段 Code Action 的执行观察，并据此继续；
- 不要尝试访问不存在的环境能力。`;
}

async function createOrResumeSession(store: SessionStore, language: RuntimeLanguage, resumeId?: string): Promise<Session> {
  if (!resumeId) return new Session(undefined, [systemMessage(codeSystemPrompt(language))]);
  const record = await store.load(resumeId);
  if (!record) throw new Error(`没有找到 Code Runtime 会话 ${resumeId}，请检查 .code-sessions/ 目录`);
  return new Session(record.id, [...record.context.messages]);
}

/** 以“一轮模型代码 → 一次 Runtime 执行”运行的交互式 Code Action 聊天。 */
export async function codeChat(
  model: Model,
  workspace: Workspace,
  options: CodeChatOptions,
  resumeId?: string,
): Promise<void> {
  const runtime = createCodeRuntime(options.language, { timeoutMs: options.codeTimeoutMs ?? 1_000 });
  const store = new SessionStore(workspace, ".code-sessions");
  const session = await createOrResumeSession(store, options.language, resumeId);
  let controller = new AbortController();

  process.on("SIGINT", () => {
    controller.abort();
    console.log("\n收到 Ctrl+C，正在取消本轮模型调用…");
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

  console.log("");
  console.log(`Hello Harness · Code Action Chat (${options.language})（输入 exit 退出，Ctrl+C 取消模型调用）`);
  const runtimeLabel = options.language === "python" ? "Python 子进程（最小内存环境）" : "Node vm + 最小 console";
  console.log(`Runtime : ${runtimeLabel}；没有文件、网络、Shell 或 Capability`);
  console.log(`Sessions: ${workspace.root}/.code-sessions`);
  console.log(resumeId ? `Resumed : ${session.id}` : `Session : ${session.id}`);

  for (;;) {
    const prompt = await ask();
    if (prompt === null || prompt.trim() === "" || prompt === "exit" || prompt === "quit") break;

    if (controller.signal.aborted) controller = new AbortController();

    session.context.add(userMessage(prompt));
    const startedAt = Date.now();
    let response;
    try {
      response = await withGuard(
        model.generate({ messages: session.context.messages }),
        options.modelTimeoutMs ?? 60_000,
        controller.signal,
        () => new RuntimeError(`模型调用超时（${options.modelTimeoutMs ?? 60_000}ms）`),
      );
    } catch (error) {
      console.log(`\n[model:error] ${error instanceof Error ? error.message : String(error)}`);
      continue;
    }

    const code = extractCode(response.content);
    const result = await runtime.execute(code);
    session.context.add(assistantMessage(runtimeObservation(code, result)));
    await store.save(session.snapshot());

    console.log(`\n[model:end ] ${model.modelName} · ${response.inputTokens} in / ${response.outputTokens} out · ${Date.now() - startedAt}ms`);
    console.log(`--- Code Action (${options.language}) ---`);
    console.log(code || "（模型没有返回代码）");
    console.log("--- RuntimeResult ---");
    console.log(JSON.stringify(result, null, 2));
  }

  rl.close();
}
