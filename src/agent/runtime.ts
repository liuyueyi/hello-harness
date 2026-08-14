import { randomUUID } from "node:crypto";
import type { Model } from "../model/model";
import type { ModelRequest, ModelResponse } from "../model/types";
import { assistantMessage, toolMessage } from "../model/messages";
import type { ToolRegistry } from "../tools/registry";
import type { ToolResult } from "../tools/tool";
import { AgentContext } from "../context/context";
import { AgentEventEmitter } from "../events/events";
import type { AgentEvent } from "../events/events";
import { ModelError, RuntimeError, ToolError, toHarnessError } from "../errors/errors";
import type { HarnessError } from "../errors/errors";
import type { AgentRun, RunStatus, StopReason } from "./run";
import type { AgentStep } from "./step";

export type { AgentRun, RunStatus, StopReason } from "./run";
export type { AgentStep } from "./step";

export interface AgentRuntimeOptions {
  maxSteps?: number;
  timeoutMs?: number;
  modelTimeoutMs?: number;
  toolTimeoutMs?: number;
  maxRetries?: number;
  retryBaseMs?: number;
  signal?: AbortSignal;
  streaming?: boolean;
}

function parseArguments(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export function withGuard<T>(
  promise: Promise<T>,
  timeoutMs: number,
  signal: AbortSignal,
  makeTimeoutError: () => HarnessError,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    if (signal.aborted) {
      reject(new RuntimeError("任务已被取消"));
      return;
    }
    let settled = false;
    const onAbort = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(new RuntimeError("任务已被取消"));
    };
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      signal.removeEventListener("abort", onAbort);
      reject(makeTimeoutError());
    }, timeoutMs);
    signal.addEventListener("abort", onAbort, { once: true });
    promise.then(
      (value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        signal.removeEventListener("abort", onAbort);
        resolve(value);
      },
      (error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        signal.removeEventListener("abort", onAbort);
        reject(error);
      },
    );
  });
}

export class AgentRuntime {
  private readonly maxSteps: number;
  private readonly timeoutMs: number;
  private readonly modelTimeoutMs: number;
  private readonly toolTimeoutMs: number;
  private readonly maxRetries: number;
  private readonly retryBaseMs: number;
  private readonly streaming: boolean;
  private readonly controller = new AbortController();
  private readonly signal = this.controller.signal;
  private readonly events = new AgentEventEmitter();
  private activeRunId?: string;

  constructor(
    private readonly model: Model,
    private readonly registry: ToolRegistry,
    options: AgentRuntimeOptions = {},
  ) {
    this.maxSteps = options.maxSteps ?? 20;
    this.timeoutMs = options.timeoutMs ?? 120_000;
    this.modelTimeoutMs = options.modelTimeoutMs ?? 60_000;
    this.toolTimeoutMs = options.toolTimeoutMs ?? 30_000;
    this.maxRetries = options.maxRetries ?? 2;
    this.retryBaseMs = options.retryBaseMs ?? 200;
    this.streaming = options.streaming ?? false;
    options.signal?.addEventListener("abort", () => this.abort(), { once: true });
  }

  on<T extends AgentEvent["type"]>(type: T, listener: (event: Extract<AgentEvent, { type: T }>) => void): void {
    this.events.on(type, listener);
  }

  off<T extends AgentEvent["type"]>(type: T, listener: (event: Extract<AgentEvent, { type: T }>) => void): void {
    this.events.off(type, listener);
  }

  abort(): void {
    this.controller.abort();
  }

  private callModel(request: ModelRequest): Promise<ModelResponse> {
    return this.streaming ? this.streamOnce(request) : this.model.generate(request);
  }

  private async streamOnce(request: ModelRequest): Promise<ModelResponse> {
    let content = "";
    let inputTokens = 0;
    let outputTokens = 0;
    const toolCalls = new Map<number, { id: string; name: string; args: string }>();

    for await (const event of this.model.stream(request)) {
      if (event.type === "content") {
        content += event.text;
        this.events.emit({ type: "model:delta", runId: this.activeRunId ?? "", text: event.text });
      } else if (event.type === "usage") {
        inputTokens = event.inputTokens;
        outputTokens = event.outputTokens;
      } else if (event.type === "tool_call") {
        const current = toolCalls.get(event.index) ?? { id: "", name: "", args: "" };
        if (event.id) current.id += event.id;
        if (event.name) current.name += event.name;
        current.args += event.arguments;
        toolCalls.set(event.index, current);
      }
    }

    return {
      content,
      toolCalls: [...toolCalls.values()]
        .filter((call) => call.name)
        .map((call) => ({ id: call.id, name: call.name, arguments: parseArguments(call.args) })),
      inputTokens,
      outputTokens,
    };
  }

  private async generate(request: ModelRequest): Promise<ModelResponse> {
    let attempt = 0;
    for (;;) {
      attempt += 1;
      try {
        return await withGuard(
          this.callModel(request),
          this.modelTimeoutMs,
          this.signal,
          () => new ModelError(`模型调用超时（${this.modelTimeoutMs}ms）`),
        );
      } catch (error) {
        if (this.signal.aborted) {
          throw new RuntimeError("任务已被取消");
        }
        const wrapped = toHarnessError(error, "model");
        if (wrapped.retryable && attempt <= this.maxRetries) {
          const delay = this.retryBaseMs * 2 ** (attempt - 1);
          this.events.emit({ type: "model:retry", runId: this.activeRunId ?? "", attempt, error: wrapped.message });
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }
        throw wrapped;
      }
    }
  }

  async run(request: ModelRequest): Promise<AgentRun> {
    const context = new AgentContext(request.messages);
    const steps: AgentStep[] = [];
    const id = randomUUID();
    const input = [...request.messages].reverse().find((m) => m.role === "user")?.content ?? "";
    const startedAt = Date.now();
    let iterations = 0;
    let lastText = "";
    let inputTokens = 0;
    let outputTokens = 0;

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
        inputTokens,
        outputTokens,
        startedAt,
        endedAt,
        ...(error ? { error: error.message, errorKind: error.kind } : {}),
      };
    };

    this.events.emit({ type: "run:start", runId: id, input });
    this.activeRunId = id;

    while (true) {
      iterations += 1;

      if (this.signal.aborted) {
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
        response = await this.generate(modelRequest);
      } catch (error) {
        if (this.signal.aborted) {
          return finish("aborted", "aborted", { error: new RuntimeError("任务已被取消") });
        }
        return finish("failed", "failed", { error: toHarnessError(error, "model") });
      }
      this.events.emit({ type: "model:end", runId: id, response, durationMs: Date.now() - modelStartedAt });
      inputTokens += response.inputTokens;
      outputTokens += response.outputTokens;
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
        let result: ToolResult;
        try {
          result = await withGuard(
            this.registry.execute(call),
            this.toolTimeoutMs,
            this.signal,
            () => new ToolError(`工具 ${call.name} 执行超时（${this.toolTimeoutMs}ms）`),
          );
        } catch (error) {
          if (this.signal.aborted) {
            return finish("aborted", "aborted", { error: new RuntimeError("任务已被取消") });
          }
          const wrapped = toHarnessError(error, "tool");
          result = { ok: false, error: wrapped.message, kind: wrapped.kind, retryable: wrapped.retryable };
        }
        this.events.emit({ type: "tool:end", runId: id, call, result, durationMs: Date.now() - toolStartedAt });
        const toolStep: AgentStep = { type: "tool", call, result };
        steps.push(toolStep);
        this.events.emit({ type: "step", runId: id, step: toolStep });
        context.add(toolMessage(call.id, JSON.stringify(result) ?? ""));
      }
    }
  }
}
