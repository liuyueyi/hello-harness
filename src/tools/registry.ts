import type { Tool, ToolResult } from "./tool";
import type { ToolCall, ToolDefinition } from "../model/types";
import { toHarnessError } from "../errors/errors";

export class ToolRegistry {
  private readonly tools = new Map<string, Tool>();

  register(tool: Tool): void {
    if (this.tools.has(tool.name)) {
      throw new Error(`工具 ${tool.name} 已注册`);
    }
    this.tools.set(tool.name, tool);
  }

  get(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  list(): ToolDefinition[] {
    return [...this.tools.values()];
  }

  async execute(call: ToolCall): Promise<ToolResult> {
    const tool = this.tools.get(call.name);
    if (!tool) {
      return { ok: false, error: `未知工具：${call.name}`, kind: "tool", retryable: false };
    }

    try {
      return await tool.execute(call.arguments);
    } catch (error) {
      const wrapped = toHarnessError(error, "tool");
      return { ok: false, error: wrapped.message, kind: wrapped.kind, retryable: wrapped.retryable };
    }
  }
}
