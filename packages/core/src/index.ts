export type { Model } from "./model/model";
export type { ModelRequest, ModelResponse, ModelEvent, ToolDefinition, ToolCall } from "./model/types";
export type { Role, Message, SystemMessage, UserMessage, AssistantMessage, ToolMessage } from "./model/messages";
export { systemMessage, userMessage, assistantMessage, toolMessage } from "./model/messages";

export { AgentRuntime, withGuard } from "./runtime/runtime";
export type { AgentRuntimeOptions } from "./runtime/runtime";
export type { AgentRun, RunStatus, StopReason } from "./runtime/run";
export type { AgentStep, ModelStep, ToolStep, FinishStep, ErrorStep } from "./runtime/step";

export { HookManager } from "./hooks/hooks";
export type { HookEvent, HookName, HookHandler } from "./hooks/hooks";

export { AgentContext } from "./context/context";
export type { ContextSnapshot } from "./context/context";

export type { Tool, ToolResult } from "./tool/tool";
export { ToolRegistry } from "./tool/registry";

export type { AgentEvent, AgentEventListener } from "./events/events";
export { AgentEventEmitter } from "./events/events";

export { Session } from "./session/session";
export type { SessionSnapshot } from "./session/session";

export { PermissionGate } from "./permission/gate";
export type { AskResolver, PermissionDecision, PermissionPolicy } from "./permission/gate";

export type { ErrorKind, HarnessError } from "./errors/errors";
export {
  ModelError,
  ToolError,
  RuntimeError,
  ContextError,
  PermissionError,
  toHarnessError,
  errorMessage,
} from "./errors/errors";