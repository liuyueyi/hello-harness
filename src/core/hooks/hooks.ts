import type { ModelRequest, ModelResponse, ToolCall } from "../model/types";
import type { ToolResult } from "../tool/tool";
import type { AgentRun } from "../runtime/run";

export type HookEvent =
  | { type: "beforeRun"; input: string }
  | { type: "afterRun"; run: AgentRun }
  | { type: "beforeModel"; request: ModelRequest }
  | { type: "afterModel"; request: ModelRequest; response: ModelResponse }
  | { type: "beforeTool"; call: ToolCall }
  | { type: "afterTool"; call: ToolCall; result: ToolResult };

export type HookName = HookEvent["type"];

export type HookHandler<E extends HookEvent = HookEvent> = (event: E) => void | Promise<void>;

export class HookManager {
  private readonly hooks = new Map<HookName, HookHandler[]>();

  register<E extends HookName>(name: E, handler: HookHandler<Extract<HookEvent, { type: E }>>): void {
    const list = this.hooks.get(name) ?? [];
    list.push(handler as HookHandler);
    this.hooks.set(name, list);
  }

  async run<E extends HookName>(name: E, event: Omit<Extract<HookEvent, { type: E }>, "type">): Promise<void> {
    for (const handler of [...(this.hooks.get(name) ?? [])]) {
      await (handler as HookHandler)({ type: name, ...event } as unknown as HookEvent);
    }
  }
}
