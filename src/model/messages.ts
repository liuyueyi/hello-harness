import type { ToolCall } from "./types";

export type Role = "system" | "user" | "assistant" | "tool";

export interface SystemMessage {
  role: "system";
  content: string;
}

export interface UserMessage {
  role: "user";
  content: string;
}

export interface AssistantMessage {
  role: "assistant";
  content: string;
  toolCalls?: ToolCall[];
}

export interface ToolMessage {
  role: "tool";
  toolCallId: string;
  content: string;
}

export type Message = SystemMessage | UserMessage | AssistantMessage | ToolMessage;

export function systemMessage(content: string): SystemMessage {
  return { role: "system", content };
}

export function userMessage(content: string): UserMessage {
  return { role: "user", content };
}

export function assistantMessage(content: string, toolCalls?: ToolCall[]): AssistantMessage {
  return { role: "assistant", content, ...(toolCalls ? { toolCalls } : {}) };
}

export function toolMessage(toolCallId: string, content: string): ToolMessage {
  return { role: "tool", toolCallId, content };
}
