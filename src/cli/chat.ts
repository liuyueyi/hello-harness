import readline from "node:readline";
import { AgentRuntime } from "../agent/runtime";
import type { AgentRuntimeOptions } from "../agent/runtime";
import type { Model } from "../model/model";
import type { ModelRequest } from "../model/types";
import type { Message } from "../model/messages";
import { userMessage } from "../model/messages";
import type { ToolRegistry } from "../tools/registry";
import type { DisplayState } from "./render";
import { subscribeEvents, printSummary } from "./render";

export async function chat(model: Model, registry: ToolRegistry, options: AgentRuntimeOptions): Promise<void> {
  const runtime = new AgentRuntime(model, registry, { ...options, streaming: true });
  const state: DisplayState = { stepCount: 0, retryCount: 0 };

  process.on("SIGINT", () => {
    console.log("\n取消本轮运行…");
    runtime.abort();
  });

  subscribeEvents(runtime, state, true);

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: !!process.stdin.isTTY });
  let closed = false;
  rl.on("close", () => {
    closed = true;
  });
  const ask = () =>
    new Promise<string | null>((resolve) => {
      if (closed) {
        resolve(null);
        return;
      }
      rl.question("你 > ", (answer) => resolve(answer));
      rl.once("close", () => resolve(null));
    });

  console.log("");
  console.log("Hello Harness v1.0 · 流式多轮对话（输入 exit 退出，Ctrl+C 取消本轮）");

  let history: Message[] = [];
  for (;;) {
    const prompt = await ask();
    if (prompt === null || prompt.trim() === "" || prompt === "exit" || prompt === "quit") break;

    state.stepCount = 0;
    state.retryCount = 0;
    const request: ModelRequest = { messages: [...history, userMessage(prompt)] };
    const run = await runtime.run(request);
    printSummary(run, state);
    history = run.history;
  }

  rl.close();
}
