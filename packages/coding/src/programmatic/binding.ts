import type { ToolCall, ToolRegistry, ErrorKind } from "@hello-harness/core";

// 程序内部一次能力调用失败的异常：携带 ToolResult 失败时的 kind，
// code 工具据此区分 permission（不许做）与 tool（做错了）
export class ProgrammaticCallError extends Error {
  constructor(
    readonly name: string,
    readonly kind: ErrorKind,
    message: string,
  ) {
    super(message);
    this.name = "ProgrammaticCallError";
  }
}

function brief(value: unknown, max = 60): string {
  if (typeof value === "string") {
    const shown = value.length <= max ? value : `${value.slice(0, max)}…`;
    return JSON.stringify(shown);
  }
  if (Array.isArray(value)) {
    const inner = value.slice(0, 3).map((v) => brief(v, max)).join(", ");
    return `[${inner}${value.length > 3 ? `, …共 ${value.length} 项` : ""}]`;
  }
  if (value && typeof value === "object") {
    const parts = Object.entries(value).map(([k, v]) => `${k}: ${brief(v, max)}`);
    const joined = parts.join(", ");
    return joined.length <= max ? `{ ${joined} }` : `{ ${joined.slice(0, max)}… }`;
  }
  return String(value);
}

// ProgrammaticToolBinding：模型程序里的能力调用 → ToolRegistry.execute。
// 这是 ch44 的核心：程序里的 read/glob/write/edit/bash 与模型直接点的 Tool 走同一条路，
// 权限门、workspace 边界、工具自身的超时与截断全部复用，一个工具都没有重新实现。
export class ProgrammaticToolBinding {
  readonly calls: string[] = []; // 能力调用轨迹，供观测与回显
  private sequence = 0;

  constructor(private readonly registry: ToolRegistry) {}

  async call<T = unknown>(name: string, arguments_: unknown): Promise<T> {
    this.sequence += 1;
    const call: ToolCall = { id: `program-${this.sequence}`, name, arguments: arguments_ };
    this.calls.push(`${name}(${brief(arguments_)})`);

    const result = await this.registry.execute(call);
    if (result.ok) {
      return result.value as T;
    }
    throw new ProgrammaticCallError(name, result.kind, result.error);
  }
}