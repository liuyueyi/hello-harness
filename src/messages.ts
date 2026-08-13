export type Role = "system" | "user" | "assistant";

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
}

export type Message = SystemMessage | UserMessage | AssistantMessage;

export function systemMessage(content: string): SystemMessage {
  return { role: "system", content };
}

export function userMessage(content: string): UserMessage {
  return { role: "user", content };
}

export function assistantMessage(content: string): AssistantMessage {
  return { role: "assistant", content };
}