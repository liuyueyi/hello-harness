import type { Message } from "../messages";

export interface ModelRequest {
  messages: Message[];
}

export interface ModelResponse {
  content: string;
  inputTokens: number;
  outputTokens: number;
}