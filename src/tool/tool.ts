import type { ToolDefinition } from "../model/types";
import type { ErrorKind } from "../errors";

export type ToolResult =
  | { ok: true; value: unknown }
  | { ok: false; error: string; kind: ErrorKind; retryable: boolean };

export interface Tool extends ToolDefinition {
  execute(input: unknown): Promise<ToolResult>;
}