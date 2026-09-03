import type { Tool, ToolResult } from "@hello-harness/core";
import type { AgentSpawner } from "../programmatic/spawner";

/**
 * ch47 · Task 工具：把子 Agent 调用封装成 Tool Calling。
 *
 * 与 read / write / bash 同级，模型通过标准 tool calling 直接调用：
 *   task({ description: "分析认证模块", prompt: "读取 src/auth.ts 并概括要点" })
 *
 * 内部调用 AgentSpawner.spawn()，创建独立 Session 的子 AgentRuntime，
 * 复用同一个 Model / ToolRegistry（权限门 / 事件 / Hook 全部继承）。
 * 子 Agent 的上下文只由「任务描述 + 可选注入文件」构成，看不到父对话历史。
 */

export interface TaskInput {
  description?: unknown;
  prompt?: unknown;
  system?: unknown;
}

export function createTaskTool(spawner: AgentSpawner): Tool {
  return {
    name: "task",
    description:
      "委派一个独立子任务给子 Agent：子 Agent 在自己的上下文窗口中运行，复用同一套工具和权限，完成后返回结构化结果。适合需要独立推理的子任务（如分析单个模块、运行测试套件、执行专项审查）。子 Agent 不会看到父对话历史，只看到你传入的任务描述和可选系统提示。",
    parameters: {
      type: "object",
      properties: {
        description: {
          type: "string",
          description: "子任务的简短描述（3-10 个词，用于工具调用日志和结果索引）",
        },
        prompt: {
          type: "string",
          description:
            "子 Agent 的完整任务指令：包含目标、输入资料路径、期望输出格式。子 Agent 只会看到这段指令，不会看到父对话上下文。",
        },
        system: {
          type: "string",
          description:
            "子 Agent 的系统提示词（可选）：定义子 Agent 的角色、行为边界和工具使用规则。不传则子 Agent 只有任务描述。",
        },
      },
      required: ["description", "prompt"],
    },
    async execute(input: unknown): Promise<ToolResult> {
      const { description, prompt, system } = input as TaskInput;
      if (typeof description !== "string" || description.trim() === "") {
        return { ok: false, error: "参数 description 必须是非空字符串", kind: "tool", retryable: false };
      }
      if (typeof prompt !== "string" || prompt.trim() === "") {
        return { ok: false, error: "参数 prompt 必须是非空字符串", kind: "tool", retryable: false };
      }

      try {
        console.log(`[DEBUG task] spawning child: description="${description}" prompt="${prompt.slice(0, 60)}..."`);
        const spawnOptions: { system?: string } = {};
        if (typeof system === "string" && system.trim() !== "") {
          spawnOptions.system = system;
        }
        const result = await spawner.spawn(prompt, spawnOptions);
        console.log(`[DEBUG task] child done: status=${result.status} runId=${result.runId?.slice(0, 8)} answerLen=${result.answer.length}`);
        const lines = [
          `[${result.status}/${result.stopReason}] ${result.answer}`,
          ``,
          `session: ${result.sessionId}`,
          `run: ${result.runId}`,
          `steps: ${result.steps} · tokens: ${result.inputTokens} in / ${result.outputTokens} out`,
        ];
        if (result.error) lines.push(`error: ${result.error}`);
        return { ok: true, value: lines.join("\n") };
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        return { ok: false, error: `子 Agent 执行失败：${msg}`, kind: "tool", retryable: false };
      }
    },
  };
}
