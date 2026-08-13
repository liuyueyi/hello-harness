export type ModelEvent =
  | { type: "content"; text: string }
  | { type: "usage"; inputTokens: number; outputTokens: number };