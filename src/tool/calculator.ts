import type { Tool, ToolResult } from "./tool";

const SAFE_EXPRESSION = /^[\d+\-*/().%\s]+$/;

export const calculator: Tool = {
  name: "calculator",
  description: "计算数学表达式，支持加减乘除、括号与取模",
  parameters: {
    type: "object",
    properties: {
      expression: {
        type: "string",
        description: "数学表达式，例如：17 * 38 或 (1 + 2) * 3",
      },
    },
    required: ["expression"],
  },
  async execute(input: unknown): Promise<ToolResult> {
    const { expression } = input as { expression?: unknown };
    if (typeof expression !== "string" || expression.trim() === "") {
      return { ok: false, error: "参数 expression 必须是字符串", kind: "tool" as const, retryable: false };
    }
    if (!SAFE_EXPRESSION.test(expression)) {
      return { ok: false, error: `表达式包含非法字符：${expression}`, kind: "tool" as const, retryable: false };
    }

    try {
      const value = Function(`"use strict"; return (${expression})`)();
      if (typeof value !== "number" || !Number.isFinite(value)) {
        return { ok: false, error: `表达式无法计算为数值：${expression}`, kind: "tool" as const, retryable: false };
      }
      return { ok: true, value };
    } catch {
      return { ok: false, error: `表达式非法：${expression}`, kind: "tool" as const, retryable: false };
    }
  },
};