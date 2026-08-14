import { randomUUID } from "node:crypto";
import type { Model } from "./model/model";
import type { ModelRequest, ModelResponse } from "./model/types";
import type { Message } from "./messages";
import { assistantMessage, toolMessage } from "./messages";
import type { ToolRegistry } from "./tool/registry";
import { AgentContext } from "./context";
import type { AgentStep } from "./step";
import { AgentEventEmitter } from "./events";
import type { AgentEvent } from "./events";
import { RuntimeError, toHarnessError } from "./errors";
import type { ErrorKind, HarnessError } from "./errors";

export type RunStatus = "running" | "completed" | "failed" | "aborted";

export type StopReason = "finished" | "maxSteps" | "timeout" | "aborted" | "failed";

export interface AgentRun {
  id: string;
  input: string;
  status: RunStatus;
  stopReason: StopReason;
  answer: string;
  history: Message[];
  steps: AgentStep[];
  iterations: number;
  error?: string;
  errorKind?: ErrorKind;
  startedAt: number;
  endedAt: number;
}

export interface AgentRuntimeOptions {
  maxSteps?: number;
  timeoutMs?: number;
  signal?: AbortSignal;
}

export class AgentRuntime {
  private readonly maxSteps: number;
  private readonly timeoutMs: number;
  private readonly signal?: AbortSignal;
  private readonly events = new AgentEventEmitter();

  constructor(
    private readonly model: Model,
    private readonly registry: ToolRegistry,
    options: AgentRuntimeOptions = {},
  ) {
    this.maxSteps = options.maxSteps ?? 20;
    this.timeoutMs = options.timeoutMs ?? 120_000;
    this.signal = options.signal;
  }

  on<T extends AgentEvent["type"]>(type: T, listener: (event: Extract<AgentEvent, { type: T }>) => void): void {
    this.events.on(type, listener);
  }

  off<T extends AgentEvent["type"]>(type: T, listener: (event: Extract<AgentEvent, { type: T }>) => void): void {
    this.events.off(type, listener);
  }

  async run(request: ModelRequest): Promise<AgentRun> {
    const context = new AgentContext(request.messages);
    const steps: AgentStep[] = [];
    const id = randomUUID();
    const input = [...request.messages].reverse().find((m) => m.role === "user")?.content ?? "";
    const startedAt = Date.now();
    let iterations = 0;
    let lastText = "";

    const finish = (
      status: Exclude<RunStatus, "running">,
      stopReason: StopReason,
      extra: { answer?: string; error?: HarnessError } = {},
    ): AgentRun => {
      const answer = extra.answer ?? lastText;
      const error = extra.error;
      const terminal: AgentStep =
        stopReason === "finished" || stopReason === "maxSteps"
          ? { type: "finish", stopReason, answer }
          : {
              type: "error",
              stopReason,
              kind: error?.kind ?? "runtime",
              retryable: error?.retryable ?? false,
              message: error?.message ?? "",
            };
      steps.push(terminal);
      this.events.emit({ type: "step", runId: id, step: terminal });
      const endedAt = Date.now();
      this.events.emit({ type: "run:end", runId: id, status, stopReason, answer, durationMs: endedAt - startedAt });
      return {
        id,
        input,
        status,
        stopReason,
        answer,
        history: context.messages,
        steps,
        iterations,
        startedAt,
        endedAt,
        ...(error ? { error: error.message, errorKind: error.kind } : {}),
      };
    };

    this.events.emit({ type: "run:start", runId: id, input });

    while (true) {
      iterations += 1;

      if (this.signal?.aborted) {
        return finish("aborted", "aborted", { error: new RuntimeError("任务已被取消") });
      }
      if (iterations > this.maxSteps) {
        return finish("completed", "maxSteps");
      }
      if (Date.now() - startedAt > this.timeoutMs) {
        return finish("failed", "timeout", { error: new RuntimeError(`超过超时上限 ${this.timeoutMs}ms`) });
      }

      let response: ModelResponse;
      const tools = this.registry.list();
      const modelRequest = { messages: context.messages, tools };
      this.events.emit({ type: "model:start", runId: id, request: modelRequest });
      const modelStartedAt = Date.now();
      try {
        response = await this.model.generate(modelRequest);
      } catch (error) {
        return finish("failed", "failed", { error: toHarnessError(error, "model") });
      }
      this.events.emit({ type: "model:end", runId: id, response, durationMs: Date.now() - modelStartedAt });
      const modelStep: AgentStep = { type: "model", request: modelRequest, response };
      steps.push(modelStep);
      this.events.emit({ type: "step", runId: id, step: modelStep });
      lastText = response.content;
      context.add(assistantMessage(response.content, response.toolCalls));

      if (response.toolCalls.length === 0) {
        return finish("completed", "finished");
      }

      for (const call of response.toolCalls) {
        this.events.emit({ type: "tool:start", runId: id, call });
        const toolStartedAt = Date.now();
        const result = await this.registry.execute(call);
        this.events.emit({ type: "tool:end", runId: id, call, result, durationMs: Date.now() - toolStartedAt });
        const toolStep: AgentStep = { type: "tool", call, result };
        steps.push(toolStep);
        this.events.emit({ type: "step", runId: id, step: toolStep });
        context.add(toolMessage(call.id, JSON.stringify(result) ?? ""));
      }
    }
  }
}
