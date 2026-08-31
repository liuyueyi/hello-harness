import type { Tool, ToolResult } from "./tool";
import type { ToolCall, ToolDefinition } from "../model/types";
import type { PermissionGate } from "../permission/gate";
import { toHarnessError } from "../errors/errors";
import type { RuntimeScope } from "../runtime/scope";

export class ToolRegistry {
  private readonly tools = new Map<string, Tool>();
  private gate?: PermissionGate;

  constructor(options: { gate?: PermissionGate } = {}) {
    this.gate = options.gate;
  }

  attachGate(gate: PermissionGate): void {
    this.gate = gate;
  }

  get permissionGate(): PermissionGate | undefined {
    return this.gate;
  }

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

  // 单个工具真正执行的内部逻辑（查表 → 权限门 → 执行 → 错误兜底）。
  // 与外壳分开，方便 execute 在它周围统一发事件 / 跑 Hook。
  private async runTool(call: ToolCall): Promise<ToolResult> {
    const tool = this.tools.get(call.name);
    if (!tool) {
      return { ok: false, error: `未知工具：${call.name}`, kind: "tool", retryable: false };
    }

    if (this.gate) {
      const { allowed, decision } = await this.gate.check(call);
      if (!allowed) {
        let error: string;
        switch (decision.action) {
          case "ask":
            error = `用户拒绝：${call.name}（${decision.reason}）`;
            break;
          case "deny":
            error = decision.reason;
            break;
          case "allow":
            error = `用户拒绝：${call.name}`;
            break;
        }
        return { ok: false, error, kind: "permission", retryable: false };
      }
    }

    try {
      return await tool.execute(call.arguments);
    } catch (error) {
      const wrapped = toHarnessError(error, "tool");
      return { ok: false, error: wrapped.message, kind: wrapped.kind, retryable: wrapped.retryable };
    }
  }

  // 统一执行入口：凡是经过注册表的工具调用，都在这里完成。
  // ch45 起，事件（tool:start / tool:end）与 Hook（beforeTool / afterTool）也在这里发出，
  // 于是「程序内能力调用」与「直接点工具」共享同一条观测线（scope 由 Runtime 注入）。
  async execute(call: ToolCall, scope?: RuntimeScope): Promise<ToolResult> {
    const runId = scope?.runId ?? "";
    const events = scope?.events;
    const hooks = scope?.hooks;

    events?.emit({ type: "tool:start", runId, call });
    await hooks?.run("beforeTool", { call });

    const startedAt = Date.now();
    const result = await this.runTool(call);

    await hooks?.run("afterTool", { call, result });
    events?.emit({ type: "tool:end", runId, call, result, durationMs: Date.now() - startedAt });
    return result;
  }
}
