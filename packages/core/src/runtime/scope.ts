import type { HookManager } from "../hooks/hooks";
import type { AgentEventEmitter } from "../events/events";

// 运行期作用域：一次 Runtime 执行期间，把「事件发射器 + HookManager + runId」挂到程序化调用链上。
// ch45 用它在内层能力调用（程序里的 read/bash/glob…）上复用同一套事件与 Hook，
// 让程序内调用与直接点工具分享同一条观测线，而不是被 Runtime 外壳隔绝。
export interface RuntimeScope {
  runId: string;
  events: AgentEventEmitter;
  hooks?: HookManager;
}

let activeScope: RuntimeScope | undefined;

/** 设置当前运行期作用域（Runtime 在每次执行工具调用周围 set/清空） */
export function setActiveRuntimeScope(scope: RuntimeScope | undefined): void {
  activeScope = scope;
}

/** 读取当前运行期作用域：code 工具在程序内发起能力调用时据此复用事件与 Hook */
export function getActiveRuntimeScope(): RuntimeScope | undefined {
  return activeScope;
}