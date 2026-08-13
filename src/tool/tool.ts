import type { ToolDefinition } from "../model/types";

export interface Tool extends ToolDefinition {
  execute(input: unknown): Promise<unknown>;
}