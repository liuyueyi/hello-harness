import type { Tool, ToolResult } from "@hello-harness/core";
import type { RuntimeLanguage, CreateCodeRuntimeOptions } from "./create";
import { createCodeRuntime } from "./create";
import type { Capability } from "./capability";
import type { CodeRuntime } from "./runtime";

export interface CodeActionToolOptions extends CreateCodeRuntimeOptions {
  /** 注入给代码执行环境的 Capability 集合（如 fs、shell）。 */
  capabilities?: Capability[];
  /**
   * 可选：外部持有的 CodeRuntime 实例。传入时工具不再自建内核，
   * 调用方可以在任务边界对同一个内核 reset（任务边界 = reset 边界）。
   */
  runtime?: CodeRuntime;
}

/** 代码即动作（Code as Action）工具的固定名称，供模型在 tool_call 中引用。 */
export const CODE_ACTION_TOOL_NAME = "code_action";

/**
 * 构造一个“代码即动作”工具：模型通过 tool_call 传入 `code`，本工具在受限的
 * CodeRuntime 中执行它，并把完整的 RuntimeResult（stdout / stderr / value / error）
 * 连同执行后的 Runtime State（内核全局变量清单）作为观察返回给模型，
 * 由模型决定继续、修正还是给出最终结论。
 *
 * state 字段是「Context = Conversation + Runtime State」的落点：内核里攒下的
 * 变量随每次观察进入对话，模型不需要重新读取或重算就知道哪些中间结果还活着。
 *
 * 该工具只依赖 code-runtime 自身与 core，不引入 coding 等上层包；
 * Capability（如 fs、shell）由调用方从上层注入，保持 core 边界干净。
 */
export function createCodeActionTool(
  language: RuntimeLanguage,
  options: CodeActionToolOptions = {},
): Tool {
  const runtime =
    options.runtime ??
    createCodeRuntime(language, {
      timeoutMs: options.timeoutMs,
      command: options.command,
      capabilities: options.capabilities,
    });

  const languageLabel = language === "python" ? "Python" : "JavaScript/TypeScript";

  return {
    name: CODE_ACTION_TOOL_NAME,
    description: `在受限的 ${languageLabel} 运行时（常驻内核）中执行一段代码，并返回其 stdout / stderr / 返回值 / 错误信息（RuntimeResult），以及执行后的内核状态 state（全局变量清单：名字/类型/预览）。用 console.log/print 输出面向用户的结论，用 return 返回结构化结果。内核在多次 code_action 之间保持存活：顶层变量会跨调用保留（持久内核），state 字段就是当前存活变量的清单——优先复用它们，不要重复计算。`,
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
      // 执行成功与否都作为观察返回给模型；state 让「内核里还有什么」随观察进入对话上下文。
      const state = await runtime.describe();
      return { ok: true, value: { ...result, state } };
    },
  };
}
