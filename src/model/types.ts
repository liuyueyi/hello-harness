import type { Message } from "../messages";

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: unknown;
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: unknown;
}

export interface ModelRequest {
  messages: Message[];
  tools?: ToolDefinition[];
}

export interface ModelResponse {
  content: string;
  toolCalls: ToolCall[];
  inputTokens: number;
  outputTokens: number;
}