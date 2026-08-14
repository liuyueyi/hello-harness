import type { Model } from "./model/model";
import type { ModelRequest, ModelResponse } from "./model/types";
import type { Message } from "./messages";
import { assistantMessage, toolMessage } from "./messages";
import type { ToolRegistry } from "./tool/registry";
import { AgentContext } from "./context";
import type { AgentStep } from "./step";

export type RunStatus = "running" | "completed" | "failed" | "aborted";

export type StopReason = "finished" | "maxSteps" | "timeout" | "aborted" | "failed";

export interface AgentResult {
  status: RunStatus;
  stopReason: StopReason;
  answer: string;
  history: Message[];
  steps: AgentStep[];
  iterations: number;
  error?: string;
}

export interface AgentRuntimeOptions {
  maxSteps?: number;
  timeoutMs?: number;
  signal?: AbortSignal;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export class AgentRuntime {
  private readonly maxSteps: number;
  private readonly timeoutMs: number;
  private readonly signal?: AbortSignal;

  constructor(
    private readonly model: Model,
    private readonly registry: ToolRegistry,
    options: AgentRuntimeOptions = {},
  ) {
    this.maxSteps = options.maxSteps ?? 20;
    this.timeoutMs = options.timeoutMs ?? 120_000;
    this.signal = options.signal;
  }

  async run(request: ModelRequest): Promise<AgentResult> {
    const context = new AgentContext(request.messages);
    const steps: AgentStep[] = [];
    const startedAt = Date.now();
    let iterations = 0;
    let lastText = "";

    const finish = (
      status: Exclude<RunStatus, "running">,
      stopReason: StopReason,
      extra: { answer?: string; error?: string } = {},
    ): AgentResult => {
      const answer = extra.answer ?? lastText;
      const error = extra.error;
      if (stopReason === "finished" || stopReason === "maxSteps") {
        steps.push({ type: "finish", stopReason, answer });
      } else {
        steps.push({ type: "error", stopReason, message: error ?? "" });
      }
      return {
        status,
        stopReason,
        answer,
        history: context.messages,
        steps,
        iterations,
        ...(error ? { error } : {}),
      };
    };

    while (true) {
      iterations += 1;

      if (this.signal?.aborted) {
        return finish("aborted", "aborted", { error: "任务已被取消" });
      }
      if (iterations > this.maxSteps) {
        return finish("completed", "maxSteps");
      }
      if (Date.now() - startedAt > this.timeoutMs) {
        return finish("failed", "timeout", { error: `超过超时上限 ${this.timeoutMs}ms` });
      }

      let response: ModelResponse;
      const tools = this.registry.list();
      try {
        response = await this.model.generate({ messages: context.messages, tools });
      } catch (error) {
        return finish("failed", "failed", { error: errorMessage(error) });
      }
      steps.push({ type: "model", request: { messages: context.messages, tools }, response });
      lastText = response.content;
      context.add(assistantMessage(response.content, response.toolCalls));

      if (response.toolCalls.length === 0) {
        return finish("completed", "finished");
      }

      for (const call of response.toolCalls) {
        const result = await this.registry.execute(call);
        steps.push({ type: "tool", call, result });
        context.add(toolMessage(call.id, JSON.stringify(result) ?? ""));
      }
    }
  }
}
