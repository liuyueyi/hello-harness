import type { Model } from "./model/model";
import type { ModelRequest, ModelResponse } from "./model/types";
import type { Message } from "./messages";
import { assistantMessage, toolMessage } from "./messages";
import type { Tool } from "./tool/tool";

export type RunStatus = "running" | "completed" | "failed" | "aborted";

export type StopReason = "finished" | "maxSteps" | "timeout" | "aborted" | "failed";

export interface AgentResult {
  status: RunStatus;
  stopReason: StopReason;
  answer: string;
  history: Message[];
  iterations: number;
  error?: string;
}

export interface AgentOptions {
  maxSteps?: number;
  timeoutMs?: number;
  signal?: AbortSignal;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export async function runAgent(
  model: Model,
  request: ModelRequest,
  tools: Record<string, Tool>,
  options: AgentOptions = {},
): Promise<AgentResult> {
  const maxSteps = options.maxSteps ?? 20;
  const timeoutMs = options.timeoutMs ?? 120_000;
  const signal = options.signal;
  const history = [...request.messages];
  const startedAt = Date.now();
  let iterations = 0;
  let lastText = "";

  const finish = (
    status: Exclude<RunStatus, "running">,
    stopReason: StopReason,
    extra: { answer?: string; error?: string } = {},
  ): AgentResult => ({
    status,
    stopReason,
    answer: extra.answer ?? lastText,
    history,
    iterations,
    ...(extra.error ? { error: extra.error } : {}),
  });

  while (true) {
    iterations += 1;

    if (signal?.aborted) {
      return finish("aborted", "aborted", { error: "任务已被取消" });
    }
    if (iterations > maxSteps) {
      return finish("completed", "maxSteps");
    }
    if (Date.now() - startedAt > timeoutMs) {
      return finish("failed", "timeout", { error: `超过超时上限 ${timeoutMs}ms` });
    }

    let response: ModelResponse;
    try {
      response = await model.generate({ messages: history, tools: Object.values(tools) });
    } catch (error) {
      return finish("failed", "failed", { error: errorMessage(error) });
    }
    lastText = response.content;
    history.push(assistantMessage(response.content, response.toolCalls));

    if (response.toolCalls.length === 0) {
      return finish("completed", "finished");
    }

    try {
      for (const call of response.toolCalls) {
        const tool = tools[call.name];
        const result = tool ? await tool.execute(call.arguments) : { error: `未知工具：${call.name}` };
        history.push(toolMessage(call.id, JSON.stringify(result) ?? ""));
      }
    } catch (error) {
      return finish("failed", "failed", { error: errorMessage(error) });
    }
  }
}