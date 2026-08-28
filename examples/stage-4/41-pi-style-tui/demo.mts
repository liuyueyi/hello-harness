import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { Workspace, createBashTool } from "@hello-harness/coding";
import { ToolRegistry, HookManager } from "@hello-harness/core";
import type { Model, ModelEvent } from "@hello-harness/core";
import { PiTui } from "@hello-harness/cli";

const scratch = path.join(os.tmpdir(), "hello-harness-pi-demo");
rmSync(scratch, { recursive: true, force: true });
mkdirSync(path.join(scratch, "src"), { recursive: true });
writeFileSync(path.join(scratch, "src", "index.ts"), "export const x = 1;\n", "utf-8");
execFileSync("git", ["init", "-b", "main"], { cwd: scratch, stdio: "ignore" });
execFileSync("git", ["config", "user.email", "demo@example.com"], { cwd: scratch, stdio: "ignore" });
execFileSync("git", ["config", "user.name", "demo"], { cwd: scratch, stdio: "ignore" });
execFileSync("git", ["add", "."], { cwd: scratch, stdio: "ignore" });
execFileSync("git", ["commit", "-m", "init"], { cwd: scratch, stdio: "ignore" });
writeFileSync(path.join(scratch, "src", "index.ts"), "export const x = 2;\n", "utf-8");

const workspace = new Workspace(scratch);
const registry = new ToolRegistry();
registry.register(createBashTool(workspace));

function createMockModel(): Model {
  // 注意：Agent Loop 在「有工具调用」时会二次调用模型——第一次产出工具调用，
  // 工具执行完后再调用一次产出最终回答。因此这里按「每次模型调用」排队，
  // 而不是按「用户轮次」排队，才能正确驱动一段带工具的真实对话。
  const calls: Array<Array<ModelEvent>> = [
    [
      { type: "reasoning", text: "先看看仓库当前状态，再决定改什么。" },
      { type: "content", text: "我先查看一下 git 状态。" },
      { type: "tool_call", index: 0, name: "bash", arguments: JSON.stringify({ command: "git status --short" }) },
      { type: "usage", inputTokens: 12, outputTokens: 20 },
    ],
    [
      { type: "content", text: "git 显示 src/index.ts 被修改：常量 x 从 1 改成了 2。改动已经确认完成。" },
      { type: "usage", inputTokens: 14, outputTokens: 22 },
    ],
    [
      { type: "reasoning", text: "用户想了解刚才的改动，直接解释即可，无需再调用工具。" },
      { type: "content", text: "改动是：src/index.ts 里常量 x 从 1 改成了 2。" },
      { type: "usage", inputTokens: 10, outputTokens: 18 },
    ],
  ];
  let index = 0;
  return {
    modelName: "mock-reason",
    async generate() {
      throw new Error("demo 使用流式模式，不应调用 generate");
    },
    async *stream() {
      const events = calls[Math.min(index++, calls.length - 1)];
      for (const event of events) {
        yield event;
      }
    },
  };
}

async function main() {
  console.log("=== 41 · Pi-style TUI：推理思考 / 工具调用 / 耗时 / token 监控 ===\n");
  const tui = new PiTui({
    model: createMockModel(),
    workspace,
    registry,
    hooks: new HookManager(),
    systemPrompt: "你是一个简洁的中文 Coding Agent。",
    options: { streaming: true, maxSteps: 5 },
  });
  await tui.runScripted(["看看这个项目的改动", "解释一下刚才的改动"]);
}

main();
