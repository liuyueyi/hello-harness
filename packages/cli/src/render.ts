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
  magenta: "\x1b[35m",
  blue: "\x1b[34m",
};

const paint = (text: string, code: string): string =>
  process.stdout.isTTY ? `${code}${text}${ANSI.reset}` : text;

export interface DisplayState {
  stepCount: number;
  retryCount: number;
}

export function subscribeEvents(runtime: AgentRuntime, state: DisplayState, streaming: boolean): void {
  let reasoningRunId = "";
  let rootRunId = "";

  const closeReasoning = (runId: string) => {
    if (reasoningRunId === runId) {
      console.log("");
      reasoningRunId = "";
    }
  };

  const isChild = (runId: string): boolean => rootRunId !== "" && runId !== rootRunId;
  const childPrefix = (runId: string): string => isChild(runId) ? paint("[子] ", ANSI.magenta) : "";
  const childColor = (runId: string): string => isChild(runId) ? ANSI.magenta : ANSI.dim;

  runtime.on("run:start", (e) => {
    rootRunId ||= e.runId;
    const prefix = childPrefix(e.runId);
    const color = childColor(e.runId);
    if (isChild(e.runId)) {
      console.log(`${paint("┌─", ANSI.magenta)} ${prefix}子 Agent 启动`);
    }
    console.log(`${paint(`[run:start]`, color)} ${prefix}Run ID : ${e.runId}`);
    console.log(`${paint(`[run:start]`, color)} ${prefix}Input  : ${e.input}`);
  });
  runtime.on("model:start", (e) => {
    const prefix = childPrefix(e.runId);
    console.log(`${paint(`[model:start]`, ANSI.yellow)} ${prefix}思考中 …`);
  });
  runtime.on("model:reasoning", (e) => {
    if (reasoningRunId !== e.runId) {
      const prefix = childPrefix(e.runId);
      process.stdout.write(`${paint(`[reasoning]`, ANSI.dim)} ${prefix}`);
      reasoningRunId = e.runId;
    }
    process.stdout.write(paint(e.text, ANSI.dim));
  });
  // DEBUG: verify child reasoning events arrive
  runtime.on("model:reasoning", (e) => {
    if (e.runId !== rootRunId && rootRunId) {
      console.error(`[DEBUG render] child reasoning event: runId=${e.runId.slice(0,8)} textLen=${e.text.length}`);
    }
  });
  if (streaming) {
    runtime.on("model:delta", (e) => {
      closeReasoning(e.runId);
      const prefix = childPrefix(e.runId);
      process.stdout.write(`${prefix}${e.text}`);
    });
  }
  runtime.on("model:end", (e) => {
    const detail =
      e.response.toolCalls.length > 0
        ? `调用工具：${e.response.toolCalls.map((c) => c.name).join(", ")}`
        : "完成回答";
    if (streaming) {
      closeReasoning(e.runId);
      console.log("");
    } else {
      closeReasoning(e.runId);
    }
    const prefix = childPrefix(e.runId);
    console.log(`${paint(`[model:end]`, ANSI.yellow)} ${prefix}${detail} · ${e.response.inputTokens} in / ${e.response.outputTokens} out · ${e.durationMs}ms`);
  });
  runtime.on("model:retry", (e) => {
    state.retryCount += 1;
    const prefix = childPrefix(e.runId);
    console.log(`${paint(`[retry]`, ANSI.red)} ${prefix}第 ${e.attempt} 次重试（已重试 ${state.retryCount} 次）：${e.error}`);
  });
  runtime.on("tool:start", (e) => {
    const prefix = childPrefix(e.runId);
    console.log(`${paint(`[tool:start]`, ANSI.cyan)} ${prefix}${e.call.name}(${JSON.stringify(e.call.arguments)})`);
  });
  runtime.on("tool:end", (e) => {
    let outcome: string;
    if (e.result.ok) {
      outcome = typeof e.result.value === "string" ? e.result.value : JSON.stringify(e.result.value);
    } else {
      outcome = `[${e.result.kind}] ${e.result.error}`;
    }
    const oneLine = outcome.replace(/\n/g, " ").slice(0, 120);
    const prefix = childPrefix(e.runId);
    console.log(`${paint(`[tool:end]`, ANSI.cyan)} ${prefix}→ ${oneLine}${outcome.length > 120 ? "…" : ""} · ${e.durationMs}ms`);
  });
  runtime.on("step", (e) => {
    state.stepCount += 1;
    const n = state.stepCount;
    const s = e.step;
    const prefix = childPrefix(e.runId);
    if (s.type === "model") {
      const label = s.response.toolCalls.length > 0
        ? `Step ${n} · model  → 调用工具：${s.response.toolCalls.map((c) => c.name).join(", ")}`
        : `Step ${n} · model  → 完成回答`;
      console.log(`${paint(`${prefix}${label}`, s.response.toolCalls.length > 0 ? ANSI.yellow : ANSI.green)}`);
    } else if (s.type === "tool") {
      const outcome = s.result.ok
        ? (typeof s.result.value === "string" ? s.result.value : JSON.stringify(s.result.value))
        : `[${s.result.kind}] ${s.result.error}`;
      const oneLine = outcome.replace(/\n/g, " ").slice(0, 120);
      const label = `Step ${n} · tool   → ${s.call.name}(${JSON.stringify(s.call.arguments)}) = ${oneLine}${outcome.length > 120 ? "…" : ""}`;
      console.log(`${paint(`${prefix}${label}`, s.result.ok ? ANSI.cyan : ANSI.red)}`);
    } else if (s.type === "finish") {
      console.log(`${paint(`${prefix}Step ${n} · finish → ${s.stopReason}`, ANSI.dim)}`);
    } else {
      console.log(`${paint(`${prefix}Step ${n} · error  → ${s.kind} (${s.stopReason}) ${s.message}`, ANSI.red)}`);
    }
  });
  runtime.on("run:end", (e) => {
    const color = e.status === "completed" ? ANSI.green : ANSI.red;
    const prefix = childPrefix(e.runId);
    if (isChild(e.runId)) {
      console.log(`${paint("└─", ANSI.magenta)} ${prefix}子 Agent 结束`);
    }
    console.log(`${paint(`[run:end]`, color)} ${prefix}${e.status} (${e.stopReason}) · ${e.durationMs}ms`);
  });
}

export function printSummary(run: AgentRun, state: DisplayState): void {
  const elapsedMs = run.endedAt - run.startedAt;
  console.log(`${paint("Answer", ANSI.bold)}  : ${run.answer}`);
  console.log(`${paint("Steps", ANSI.bold)}   : ${run.iterations} 轮 · ${run.history.length} 条消息 · ${state.stepCount} 步 · ${elapsedMs}ms`);
  console.log(`${paint("Tokens", ANSI.bold)}  : ${run.inputTokens} in / ${run.outputTokens} out`);
  console.log(`${paint("Status", ANSI.bold)}  : ${run.status} (${run.stopReason})${run.error ? ` · [${run.errorKind}] ${run.error}` : ""}${state.retryCount > 0 ? ` · 重试 ${state.retryCount} 次` : ""}`);
}