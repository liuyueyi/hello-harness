import type { Tool, ToolResult } from "../core/tool/tool";

export const randomInteger: Tool = {
  name: "random_integer",
  description: "生成一个 0 到 max（不含 max）之间的随机整数",
  parameters: {
    type: "object",
    properties: {
      max: {
        type: "integer",
        description: "上界（不含），例如 100 表示 0~99",
      },
    },
    required: ["max"],
  },
  async execute(input: unknown): Promise<ToolResult> {
    const { max } = input as { max?: unknown };
    if (typeof max !== "number" || !Number.isFinite(max) || max <= 0) {
      return { ok: false, error: "参数 max 必须是正数", kind: "tool" as const, retryable: false };
    }
    return { ok: true, value: Math.floor(Math.random() * max) };
  },
};
