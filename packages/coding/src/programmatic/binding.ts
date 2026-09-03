import type { ToolCall, ToolRegistry, ErrorKind } from "@hello-harness/core";
import { getActiveRuntimeScope } from "@hello-harness/core";

// 程序内部一次能力调用失败的异常：携带 kind 与工具名（toolName），
// code 工具据此区分 permission（治理层：不许做）与 tool（工具层：做错了）。
// ch45：构造参数命名为 toolName，避免覆盖 Error.name（ch44 记录的字段碰撞债）。
export class ProgrammaticCallError extends Error {
  constructor(
    readonly toolName: string,
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

// —— 程序能力的治理清单（ch45 定义）——
// capabilities：程序里允许调用的工具名（能力白名单）。
// requireAllowlist：程序里允许 require 的模块 id（去 node: 前缀后比较）。
// maxCalls：一次程序里最多允许多少次能力调用（预算），防止失控循环把 Harness 拖垮。
export interface ProgrammaticPolicy {
  capabilities?: string[];
  requireAllowlist?: string[];
  maxCalls?: number;
}

export const DEFAULT_PROGRAM_CAPABILITIES = ["glob", "read", "write", "edit", "bash"];
export const DEFAULT_PROGRAM_REQUIRE_ALLOWLIST = ["path", "util", "os"];
export const DEFAULT_PROGRAM_MAX_CALLS = 100;

// ProgrammaticToolBinding：模型程序里的能力调用 → ToolRegistry.execute。
// ch44 把能力连进注册表；ch45 在桥上装上三块治理闸：
//   ① 能力白名单（清单外的工具名直接拒绝）
//   ② require 白名单（fs/child_process 等一律拒绝）
//   ③ 调用预算 + 终止开关（程序结束/超时后，剩余异步调用全部失效）
export class ProgrammaticToolBinding {
  readonly calls: string[] = []; // 允许放行的能力调用轨迹
  readonly denied: string[] = []; // 被治理闸拒绝的调用记录（清单 / 预算 / 已终止）

  private sequence = 0;
  private callCount = 0;
  private terminated = false;
  private terminationReason = "";
  private readonly capabilities: Set<string>;
  private readonly requireAllowlist: Set<string>;
  private readonly maxCalls: number;

  constructor(
    private readonly registry: ToolRegistry,
    policy: ProgrammaticPolicy = {},
  ) {
    this.capabilities = new Set(policy.capabilities ?? DEFAULT_PROGRAM_CAPABILITIES);
    this.requireAllowlist = new Set(policy.requireAllowlist ?? DEFAULT_PROGRAM_REQUIRE_ALLOWLIST);
    this.maxCalls = policy.maxCalls ?? DEFAULT_PROGRAM_MAX_CALLS;
  }

  get isTerminated(): boolean {
    return this.terminated;
  }

  // 程序收尾（正常结束 / 超时 / 预算越界）后调用：剩余还在跑的异步程序段，
  // 再想发起能力调用会全部抛「程序已被终止」。kill-switch 无法停掉同步死循环，
  // 但能封锁「终止之后的一切后续能力调用」，把 blast-radius 收在能力闸以内。
  terminate(reason: string): void {
    this.terminated = true;
    this.terminationReason = reason;
  }

  // require 的白名单门：去 node: 前缀后逐项核对。fs / child_process / http 等不在名单，直接拒绝。
  assertRequireAllowed(id: string): string {
    const normalized = id.replace(/^node:/, "");
    if (this.requireAllowlist.has(normalized)) {
      return normalized;
    }
    const message = `程序 require 超出白名单：${id}（允许：${[...this.requireAllowlist].join(" / ")}；config 里可配 programRequireAllowlist）`;
    this.denied.push(`require(${JSON.stringify(id)})`);
    throw new ProgrammaticCallError("require", "permission", message);
  }

  async call<T = unknown>(name: string, arguments_: unknown): Promise<T> {
    // 三道治理闸，按序挡住三种失控
    if (this.terminated) {
      const why = `程序已被终止（${this.terminationReason}），不再允许发起能力调用`;
      this.denied.push(`${name}(...) ｜ ${why}`);
      throw new ProgrammaticCallError(name, "permission", why);
    }
    if (!this.capabilities.has(name)) {
      const why = `程序能力清单里没有 ${name}（允许：${[...this.capabilities].join(" / ")}；config 里可配 programCapabilities）`;
      this.denied.push(`${name}(...) ｜ 超能力白名单`);
      throw new ProgrammaticCallError(name, "permission", why);
    }
    if (this.callCount >= this.maxCalls) {
      const why = `程序能力调用超出预算（${this.maxCalls} 次上限），被强制终止`;
      this.denied.push(`${name}(...) ｜ 超预算`);
      this.terminate("超出能力调用预算");
      throw new ProgrammaticCallError(name, "permission", why);
    }

    this.callCount += 1;
    this.sequence += 1;
    const call: ToolCall = { id: `program-${this.sequence}`, name, arguments: arguments_ };
    this.calls.push(`${name}(${brief(arguments_)})`);

    // 放行后的执行仍走注册表：内层调用共享当前运行期的事件与 Hook。
    const scope = getActiveRuntimeScope();
    const result = await this.registry.execute(
      call,
      scope ? { runId: scope.runId, events: scope.events, hooks: scope.hooks } : undefined,
    );
    if (result.ok) {
      return result.value as T;
    }
    throw new ProgrammaticCallError(name, result.kind, result.error);
  }
}