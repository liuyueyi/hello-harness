import type { AgentRuntime } from "@hello-harness/core";
import type { AgentRun } from "@hello-harness/core";

export interface DisplayState {
  stepCount: number;
  retryCount: number;
}

export function subscribeEvents(runtime: AgentRuntime, state: DisplayState, streaming: boolean): void {
  runtime.on("run:start", (e) => {
    console.log(`[run:start ] Run ID : ${e.runId}`);
    console.log(`[run:start ] Input  : ${e.input}`);
  });
  runtime.on("model:start", () => {
    console.log(`[model:start] 思考中 …`);
  });
  if (streaming) {
    runtime.on("model:delta", (e) => {
      process.stdout.write(e.text);
    });
  }
  runtime.on("model:end", (e) => {
    const detail =
      e.response.toolCalls.length > 0
        ? `调用工具：${e.response.toolCalls.map((c) => c.name).join(", ")}`
        : "完成回答";
    if (streaming) console.log("");
    console.log(`[model:end ] ${detail} · ${e.response.inputTokens} in / ${e.response.outputTokens} out · ${e.durationMs}ms`);
  });
  runtime.on("model:retry", (e) => {
    state.retryCount += 1;
    console.log(`[retry     ] 第 ${e.attempt} 次重试（已重试 ${state.retryCount} 次）：${e.error}`);
  });
  runtime.on("tool:start", (e) => {
    console.log(`[tool:start] ${e.call.name}(${JSON.stringify(e.call.arguments)})`);
  });
  runtime.on("tool:end", (e) => {
    const outcome = e.result.ok ? JSON.stringify(e.result.value) : `[${e.result.kind}] ${e.result.error}`;
    console.log(`[tool:end  ] → ${outcome} · ${e.durationMs}ms`);
  });
  runtime.on("step", (e) => {
    state.stepCount += 1;
    const n = state.stepCount;
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
  runtime.on("run:end", (e) => {
    console.log(`[run:end   ] ${e.status} (${e.stopReason}) · ${e.durationMs}ms`);
  });
}

export function printSummary(run: AgentRun, state: DisplayState): void {
  const elapsedMs = run.endedAt - run.startedAt;
  console.log(`Answer  : ${run.answer}`);
  console.log(`Steps   : ${run.iterations} 轮 · ${run.history.length} 条消息 · ${state.stepCount} 步 · ${elapsedMs}ms`);
  console.log(`Tokens  : ${run.inputTokens} in / ${run.outputTokens} out`);
  console.log(`Status  : ${run.status} (${run.stopReason})${run.error ? ` · [${run.errorKind}] ${run.error}` : ""}${state.retryCount > 0 ? ` · 重试 ${state.retryCount} 次` : ""}`);
}
