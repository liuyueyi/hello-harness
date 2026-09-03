/**
 * 47 · Agent as Function：子 Agent 调用封装成 Tool Calling
 *
 * 模型通过 `task` 工具直接委派子任务：task({ description, prompt })
 * → AgentSpawner 创建子 Runtime + 独立 Session → 结果回到模型上下文。
 * 不需要写代码来调用子 Agent——task 与 read / write / bash 同级。
 */

import type {
  Model,
  ModelEvent,
  ModelRequest,
  ModelResponse,
  ToolCall,
} from "@hello-harness/core";
import { AgentRuntime, ToolRegistry, systemMessage, userMessage } from "@hello-harness/core";
import {
  AgentSpawner,
  Workspace,
  createCodeActionTool,
  createReadTool,
  createTaskTool,
} from "@hello-harness/coding";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const scratch = path.join(os.tmpdir(), "hello-harness-47-agent-function");
const AUTH_SRC = `// 认证模块（src/auth.ts）
export function verifyToken(token: string, now = Date.now()): boolean {
  if (!token.startsWith("hv_")) return false;
  return now - issuedAt(token) < 15 * 60_000; // 15 分钟过期
}
export function issuedAt(token: string): number {
  return Number(token.slice(3));
}
`;
const API_SRC = `// API 模块（src/api.ts）
export const routes = ["/auth/login", "/auth/refresh", "/projects", "/users"];
export function handleError(code: number): string {
  if (code === 401) return "未认证，请重新登录";
  if (code === 403) return "权限不足";
  return \`请求失败（\${code}）\`;
}
`;

// 确定性模型：模拟真实 LLM 的 tool calling 行为
//   首轮 → 调用 task 工具两次（认证模块 / API 模块分析）
//   子 Agent 轮 → 基于 prompt 中的模块信息直接回答（模拟真实子 Agent 读文件后总结）
//   收到 task 结果后 → 直接回答汇总
class DeterministicTaskModel implements Model {
  readonly modelName = "47-agent-function-demo";
  private taskCallCount = 0;

  async generate(request: ModelRequest): Promise<ModelResponse> {
    const last = request.messages[request.messages.length - 1];

    // 收到 tool 结果（task 工具返回的子 Agent 结论）→ 汇总回答
    if (last.role === "tool") {
      return {
        content: "分析完成：认证模块与 API 模块的结论已汇总。",
        toolCalls: [],
        inputTokens: 950,
        outputTokens: 70,
      };
    }

    // 子 Agent 轮：子 Session 只有 system(可选) + user，没有 tool 历史
    // 判断依据：消息列表中没有 tool 角色的消息
    const hasToolMessages = request.messages.some((m) => m.role === "tool");
    const isSubAgent = !hasToolMessages && last.role === "user" && this.taskCallCount > 0;
    if (isSubAgent) {
      const userText = typeof last.content === "string" ? last.content : "";
      if (userText.includes("认证") || userText.includes("auth")) {
        return {
          content:
            "认证模块的要点：Authorization 头携带 hv_ 前缀的签名 token，verifyToken() 校验前缀与 15 分钟过期时间（src/auth.ts）。",
          toolCalls: [],
          inputTokens: 260,
          outputTokens: 40,
        };
      }
      if (userText.includes("API") || userText.includes("api") || userText.includes("路由")) {
        return {
          content:
            "API 模块的要点：4 条路由（/auth/login、/auth/refresh、/projects、/users），handleError() 对 401/403 给出明确提示（src/api.ts）。",
          toolCalls: [],
          inputTokens: 240,
          outputTokens: 38,
        };
      }
    }

    // 首轮：调用 task 工具拆分两个子任务
    if (this.taskCallCount === 0) {
      this.taskCallCount++;
      return {
        content: "这个任务适合拆分给子 Agent。我来调用 task 工具分别分析两个模块。",
        toolCalls: [
          {
            id: "t1",
            name: "task",
            arguments: {
              description: "分析认证模块",
              prompt:
                "你是子 Agent。请读取 src/auth.ts 并概括认证机制的实现要点，包括 token 格式、校验逻辑和过期策略。不修改任何文件。",
            },
          } satisfies ToolCall,
          {
            id: "t2",
            name: "task",
            arguments: {
              description: "分析 API 模块",
              prompt:
                "你是子 Agent。请读取 src/api.ts 并概括路由结构与错误处理方式。不修改任何文件。",
            },
          } satisfies ToolCall,
        ],
        inputTokens: 310,
        outputTokens: 30,
      };
    }

    return {
      content: "分析完成。",
      toolCalls: [],
      inputTokens: 100,
      outputTokens: 10,
    };
  }

  async *stream(_request: ModelRequest): AsyncIterable<ModelEvent> {
    throw new Error("本 demo 使用 generate 模式");
  }
}

function parseTaskResult(value: string): { runId: string; sessionId: string; status: string; answer: string } | null {
  const statusMatch = value.match(/^\[([^\]/]+)\/([^\]]+)\]\s*(.*)/s);
  const sessionMatch = value.match(/^session:\s*(.+)$/m);
  const runMatch = value.match(/^run:\s*(.+)$/m);
  if (!statusMatch || !sessionMatch || !runMatch) return null;
  return {
    status: statusMatch[1],
    runId: runMatch[1].trim(),
    sessionId: sessionMatch[1].trim(),
    answer: statusMatch[3].trim(),
  };
}

async function main() {
  rmSync(scratch, { recursive: true, force: true });
  mkdirSync(path.join(scratch, "src"), { recursive: true });
  writeFileSync(path.join(scratch, "src", "auth.ts"), AUTH_SRC, "utf-8");
  writeFileSync(path.join(scratch, "src", "api.ts"), API_SRC, "utf-8");

  const workspace = new Workspace(scratch);
  const registry = new ToolRegistry();
  registry.register(createReadTool(workspace));

  const model = new DeterministicTaskModel();
  const spawner = new AgentSpawner(model, registry, { maxSteps: 6, timeoutMs: 30_000 });

  // task 工具：模型通过标准 tool calling 委派子任务
  registry.register(createTaskTool(spawner));
  // code 工具：不含 agent，回归纯编程能力
  registry.register(createCodeActionTool(workspace, registry));

  const runtime = new AgentRuntime(model, registry, { maxSteps: 8 });
  let rootRunId = "";
  const taskResults: Array<{ runId: string; sessionId: string; status: string; answer: string }> = [];

  console.log("=== 47 · Agent as Function（Tool Calling 驱动）===\n");
  runtime.on("run:start", (e) => {
    rootRunId ||= e.runId;
    const tag = e.runId === rootRunId ? "父" : "子";
    console.log(`[run:start ${tag}] ${e.runId.slice(0, 8)} · 输入：${e.input.slice(0, 64)}`);
  });
  runtime.on("model:end", (e) => {
    const tag = e.runId === rootRunId ? "父" : "子";
    const decision =
      e.response.toolCalls.length > 0
        ? `调用 ${e.response.toolCalls.map((c) => c.name).join(", ")}`
        : "无工具调用，直接回答";
    console.log(
      `[model:end ${tag}] ${decision} · ${e.response.inputTokens} in / ${e.response.outputTokens} out`,
    );
  });
  runtime.on("tool:end", (e) => {
    console.log(`[tool:end ] ${e.call.name}`);
    const value = e.result.ok ? e.result.value : undefined;
    if (typeof value === "string") {
      for (const line of value.split("\n")) {
        console.log(`   ${line}`);
      }
      if (e.call.name === "task") {
        const parsed = parseTaskResult(value);
        if (parsed) taskResults.push(parsed);
      }
    } else {
      console.log(`   → ok=${e.result.ok}${e.result.ok ? "" : ` · 失败：${e.result.error}`}`);
    }
  });

  const run = await runtime.run({
    messages: [
      systemMessage("你是一个善于拆解任务的 Coding Agent：组合/并行分析任务优先用 task 工具委派给子 Agent。"),
      userMessage("用 task 工具把认证与 API 两个模块拆给子 Agent 分析，并汇总结论。"),
    ],
  });

  const [childAuth, childApi] = taskResults;
  const historyText = run.history.map((m) => (typeof m.content === "string" ? m.content : "")).join("\n");
  const checks: Array<[string, boolean]> = [
    ["子 Agent 全部复用同一套 Runtime：completed / finished",
      childAuth?.status === "completed" && childApi?.status === "completed"],
    ["子 Agent 各有独立 Session：2 个 sessionId 互不相同",
      childAuth?.sessionId !== childApi?.sessionId],
    ["子 Agent 的 runId 与父 run 不同",
      ![childAuth?.runId, childApi?.runId].includes(run.id)],
    ["注入资料生效：子 A 结论提到 verifyToken 与 15 分钟过期",
      (childAuth?.answer.includes("verifyToken") ?? false) && (childAuth?.answer.includes("15 分钟") ?? false)],
    ["注入资料生效：子 B 结论提到路由与 401",
      (childApi?.answer.includes("路由") ?? false) && (childApi?.answer.includes("401") ?? false)],
    ["父模型收到子 Agent 结论并汇总",
      historyText.includes("分析完成")],
  ];

  console.log("");
  console.log("=== 运行结果 ===");
  console.log(`父 Agent：${run.status} / ${run.stopReason} · Run ${run.id.slice(0, 8)} · ${run.iterations} 轮`);
  console.log(`子 Agent：${taskResults.length} 个 · 均从同一个 AgentSpawner 派生`);
  console.log("");
  console.log("=== 验证清单 ===");
  for (const [label, ok] of checks) {
    console.log(`[${ok ? "pass" : "FAIL"}] ${label}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
