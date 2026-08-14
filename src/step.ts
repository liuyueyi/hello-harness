import type { ModelRequest, ModelResponse, ToolCall } from "./model/types";
import type { ToolResult } from "./tool/tool";
import type { StopReason } from "./runtime";
import type { ErrorKind } from "./errors";

export type AgentStep = ModelStep | ToolStep | FinishStep | ErrorStep;

export interface ModelStep {
  type: "model";
  request: ModelRequest;
  response: ModelResponse;
}

export interface ToolStep {
  type: "tool";
  call: ToolCall;
  result: ToolResult;
}

export interface FinishStep {
  type: "finish";
  stopReason: StopReason;
  answer: string;
}

export interface ErrorStep {
  type: "error";
  stopReason: StopReason;
  kind: ErrorKind;
  retryable: boolean;
  message: string;
}