import type { Tool, ToolResult } from "@hello-harness/core";
import type { RuntimeLanguage, CreateCodeRuntimeOptions } from "./create";
import { createCodeRuntime } from "./create";
import type { Capability } from "./capability";

export interface CodeActionToolOptions extends CreateCodeRuntimeOptions {
  /** 注入给代码执行环境的 Capability 集合（如 fs、shell）。 */
  capabilities?: Capability[];
}

/** 代码即动作（Code as Action）工具的固定名称，供模型在 tool_call 中引用。 */
export const CODE_ACTION_TOOL_NAME = "code_action";

/**
 * 构造一个“代码即动作”工具：模型通过 tool_call 传入 `code`，本工具在受限的
 * CodeRuntime 中执行它，并把完整的 RuntimeResult（stdout / stderr / value / error）
 * 作为观察返回给模型，由模型决定继续、修正还是给出最终结论。
 *
 * 该工具只依赖 code-runtime 自身与 core，不引入 coding 等上层包；
 * Capability（如 fs、shell）由调用方从上层注入，保持 core 边界干净。
 */
export function createCodeActionTool(
  language: RuntimeLanguage,
  options: CodeActionToolOptions = {},
): Tool {
  const runtime = createCodeRuntime(language, {
    timeoutMs: options.timeoutMs,
    command: options.command,
    capabilities: options.capabilities,
  });

  const languageLabel = language === "python" ? "Python" : "JavaScript/TypeScript";

  return {
    name: CODE_ACTION_TOOL_NAME,
    description: `在受限的 ${languageLabel} 运行时中执行一段代码，并返回其 stdout / stderr / 返回值 / 错误信息（RuntimeResult）。用 console.log/print 输出面向用户的结论，用 return 返回结构化结果。`,
    parameters: {
      type: "object",
      properties: {
        code: {
          type: "string",
          description: "要执行的可直接运行的代码片段；不要 Markdown 围栏、不要 import/export。",
        },
      },
      required: ["code"],
    },
    async execute(input: unknown): Promise<ToolResult> {
      const code =
        input && typeof input === "object" && "code" in input
          ? String((input as Record<string, unknown>).code ?? "")
          : typeof input === "string"
            ? input
            : "";

      if (code.trim() === "") {
        return { ok: false, error: "code_action 调用缺少 code 参数", kind: "tool", retryable: false };
      }

      const result = await runtime.execute(code);
      // 执行成功与否都作为观察返回给模型，让模型自行决定重试或继续。
      return { ok: true, value: result };
    },
  };
}
