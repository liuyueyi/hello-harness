import type { ToolDefinition } from "../model/types";

export type ToolResult =
  | { ok: true; value: unknown }
  | { ok: false; error: string };

export interface Tool extends ToolDefinition {
  execute(input: unknown): Promise<ToolResult>;
}