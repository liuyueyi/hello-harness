import type { AgentRuntime } from "@hello-harness/core";
import type { AgentRun } from "@hello-harness/core";

const ANSI = {
  reset: "\x1b[0m",
  dim: "\x1b[90m",
  bold: "\x1b[1m",
  cyan: "\x1b[36m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
};

const paint = (text: string, code: string): string =>
  process.stdout.isTTY ? `${code}${text}${ANSI.reset}` : text;

export interface DisplayState {
  stepCount: number;
  retryCount: number;
}

export function subscribeEvents(runtime: AgentRuntime, state: DisplayState, streaming: boolean): void {
  let reasoningStarted = false;

  const closeReasoning = () => {
    if (reasoningStarted) {
      console.log("");
      reasoningStarted = false;
    }
  };

  runtime.on("run:start", (e) => {
    console.log(`${paint("[run:start ]", ANSI.dim)} Run ID : ${e.runId}`);
    console.log(`${paint("[run:start ]", ANSI.dim)} Input  : ${e.input}`);
  });
  runtime.on("model:start", () => {
    console.log(`${paint("[model:start]", ANSI.yellow)} 思考中 …`);
  });
  runtime.on("model:reasoning", (e) => {
    if (!reasoningStarted) {
      process.stdout.write(`${paint("[reasoning ]", ANSI.dim)} `);
      reasoningStarted = true;
    }
    process.stdout.write(paint(e.text, ANSI.dim));
  });
  if (streaming) {
    runtime.on("model:delta", (e) => {
      closeReasoning();
      process.stdout.write(e.text);
    });
  }
  runtime.on("model:end", (e) => {
    const detail =
      e.response.toolCalls.length > 0
        ? `调用工具：${e.response.toolCalls.map((c) => c.name).join(", ")}`
        : "完成回答";
    if (streaming) {
      closeReasoning();
      console.log("");
    } else {
      closeReasoning();
    }
    console.log(`${paint("[model:end ]", ANSI.yellow)} ${detail} · ${e.response.inputTokens} in / ${e.response.outputTokens} out · ${e.durationMs}ms`);
  });
  runtime.on("model:retry", (e) => {
    state.retryCount += 1;
    console.log(`${paint("[retry     ]", ANSI.red)} 第 ${e.attempt} 次重试（已重试 ${state.retryCount} 次）：${e.error}`);
  });
  runtime.on("tool:start", (e) => {
    console.log(`${paint("[tool:start]", ANSI.cyan)} ${e.call.name}(${JSON.stringify(e.call.arguments)})`);
  });
  runtime.on("tool:end", (e) => {
    const outcome = e.result.ok ? JSON.stringify(e.result.value) : `[${e.result.kind}] ${e.result.error}`;
    console.log(`${paint("[tool:end  ]", ANSI.cyan)} → ${outcome} · ${e.durationMs}ms`);
  });
  runtime.on("step", (e) => {
    state.stepCount += 1;
    const n = state.stepCount;
    const s = e.step;
    if (s.type === "model") {
      const label = s.response.toolCalls.length > 0
        ? `Step ${n} · model  → 调用工具：${s.response.toolCalls.map((c) => c.name).join(", ")}`
        : `Step ${n} · model  → 完成回答`;
      console.log(`${paint(label, s.response.toolCalls.length > 0 ? ANSI.yellow : ANSI.green)}`);
    } else if (s.type === "tool") {
      const outcome = s.result.ok ? JSON.stringify(s.result.value) : `[${s.result.kind}] ${s.result.error}`;
      const label = `Step ${n} · tool   → ${s.call.name}(${JSON.stringify(s.call.arguments)}) = ${outcome}`;
      console.log(`${paint(label, s.result.ok ? ANSI.cyan : ANSI.red)}`);
    } else if (s.type === "finish") {
      console.log(`${paint(`Step ${n} · finish → ${s.stopReason}`, ANSI.dim)}`);
    } else {
      console.log(`${paint(`Step ${n} · error  → ${s.kind} (${s.stopReason}) ${s.message}`, ANSI.red)}`);
    }
  });
  runtime.on("run:end", (e) => {
    const color = e.status === "completed" ? ANSI.green : ANSI.red;
    console.log(`${paint("[run:end   ]", color)} ${e.status} (${e.stopReason}) · ${e.durationMs}ms`);
  });
}

export function printSummary(run: AgentRun, state: DisplayState): void {
  const elapsedMs = run.endedAt - run.startedAt;
  console.log(`${paint("Answer", ANSI.bold)}  : ${run.answer}`);
  console.log(`${paint("Steps", ANSI.bold)}   : ${run.iterations} 轮 · ${run.history.length} 条消息 · ${state.stepCount} 步 · ${elapsedMs}ms`);
  console.log(`${paint("Tokens", ANSI.bold)}  : ${run.inputTokens} in / ${run.outputTokens} out`);
  console.log(`${paint("Status", ANSI.bold)}  : ${run.status} (${run.stopReason})${run.error ? ` · [${run.errorKind}] ${run.error}` : ""}${state.retryCount > 0 ? ` · 重试 ${state.retryCount} 次` : ""}`);
}
