import readline from "node:readline";
import { AgentRuntime } from "../agent/runtime";
import type { AgentRuntimeOptions } from "../agent/runtime";
import type { Model } from "../model/model";
import { systemMessage } from "../model/messages";
import type { ToolRegistry } from "../tools/registry";
import type { Workspace } from "../workspace/workspace";
import type { DisplayState } from "./render";
import { subscribeEvents, printSummary } from "./render";
import { Session } from "../session/session";
import { SessionStore } from "../session/store";

async function createOrResumeSession(
  store: SessionStore,
  systemPrompt: string,
  resumeId?: string,
): Promise<Session> {
  if (!resumeId) {
    return new Session(undefined, [systemMessage(systemPrompt)]);
  }
  const record = await store.load(resumeId);
  if (!record) {
    throw new Error(`没有找到会话 ${resumeId}，请检查 .sessions/ 目录`);
  }
  return new Session(record.id, [...record.context.messages]);
}

export async function chat(
  model: Model,
  registry: ToolRegistry,
  systemPrompt: string,
  workspace: Workspace,
  options: AgentRuntimeOptions,
  resumeId?: string,
): Promise<void> {
  const runtime = new AgentRuntime(model, registry, { ...options, streaming: true });
  const store = new SessionStore(workspace);
  const session = await createOrResumeSession(store, systemPrompt, resumeId);
  const state: DisplayState = { stepCount: 0, retryCount: 0 };

  process.on("SIGINT", () => {
    console.log("\n取消本轮运行…");
    runtime.abort();
  });

  subscribeEvents(runtime, state, true);

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
    if (pending) {
      pending(null);
      pending = null;
    }
  });
  const ask = () =>
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
      rl.prompt();
    });

  console.log("");
  console.log("Hello Harness v1.0 · 流式多轮对话（输入 exit 退出，Ctrl+C 取消本轮）");
  if (resumeId) {
    console.log(`Resumed : ${session.id}（${session.context.messages.length} 条历史消息）`);
  } else {
    console.log(`Session : ${session.id}`);
  }
  console.log(`Sessions: ${workspace.root}/.sessions`);

  for (;;) {
    const prompt = await ask();
    if (prompt === null || prompt.trim() === "" || prompt === "exit" || prompt === "quit") break;

    state.stepCount = 0;
    state.retryCount = 0;
    const run = await session.turn(runtime, prompt);
    await store.save(session.snapshot());
    printSummary(run, state);
  }

  rl.close();
}