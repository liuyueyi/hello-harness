import type { ModelRequest, ModelResponse, ToolCall } from "../model/types";
import type { ToolResult } from "../tool/tool";
import type { AgentStep } from "../runtime/step";
import type { RunStatus, StopReason } from "../runtime/run";

export type AgentEvent =
  | { type: "run:start"; runId: string; input: string }
  | { type: "model:start"; runId: string; request: ModelRequest }
  | { type: "model:delta"; runId: string; text: string }
  | { type: "model:end"; runId: string; response: ModelResponse; durationMs: number }
  | { type: "model:retry"; runId: string; attempt: number; error: string }
  | { type: "tool:start"; runId: string; call: ToolCall }
  | { type: "tool:end"; runId: string; call: ToolCall; result: ToolResult; durationMs: number }
  | { type: "step"; runId: string; step: AgentStep }
  | { type: "run:end"; runId: string; status: RunStatus; stopReason: StopReason; answer: string; durationMs: number };

export type AgentEventListener = (event: AgentEvent) => void;

export class AgentEventEmitter {
  private readonly listeners = new Map<AgentEvent["type"], AgentEventListener[]>();

  on<T extends AgentEvent["type"]>(type: T, listener: (event: Extract<AgentEvent, { type: T }>) => void): void {
    const list = this.listeners.get(type) ?? [];
    list.push(listener as AgentEventListener);
    this.listeners.set(type, list);
  }

  off<T extends AgentEvent["type"]>(type: T, listener: (event: Extract<AgentEvent, { type: T }>) => void): void {
    const list = this.listeners.get(type);
    if (!list) return;
    this.listeners.set(type, list.filter((l) => l !== listener));
  }

  emit(event: AgentEvent): void {
    for (const listener of [...(this.listeners.get(event.type) ?? [])]) {
      listener(event);
    }
  }
}