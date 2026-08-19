import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { Workspace } from "@hello-harness/coding";
import { ToolRegistry } from "@hello-harness/core";
import { AgentRuntime } from "@hello-harness/core";
import { userMessage } from "@hello-harness/core";
import { createBashTool } from "@hello-harness/coding";
import { Tui } from "@hello-harness/cli";
import type { Model, ModelEvent } from "@hello-harness/core";

const scratch = path.join(os.tmpdir(), "hello-harness-tui-demo");
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

function createStreamingModel(): Model {
  const turns: Array<Array<ModelEvent>> = [
    [
      { type: "content", text: "让我先看看当前 git 状态。" },
      { type: "tool_call", index: 0, name: "bash", arguments: JSON.stringify({ command: "git status --short" }) },
      { type: "usage", inputTokens: 6, outputTokens: 9 },
    ],
    [
      { type: "content", text: "状态确认，改动在 src/index.ts。再看下具体 diff。" },
      { type: "tool_call", index: 0, name: "bash", arguments: JSON.stringify({ command: "git diff src/index.ts" }) },
      { type: "usage", inputTokens: 8, outputTokens: 11 },
    ],
    [
      { type: "content", text: "改动就一行：把常量从 1 改成 2。完成。" },
      { type: "usage", inputTokens: 4, outputTokens: 7 },
    ],
  ];
  let index = 0;
  return {
    modelName: "fake-tui",
    async generate() {
      throw new Error("TUI demo 使用流式模式，不应调用 generate");
    },
    async *stream() {
      for (const event of turns[Math.min(index++, turns.length - 1)]) {
        yield event;
      }
    },
  };
}

async function main() {
  console.log("=== 39 · TUI：thinking / tool call / tool result / diff / token 一屏看全 ===");

  const runtime = new AgentRuntime(createStreamingModel(), registry, { streaming: true, maxSteps: 5 });
  const tui = new Tui({ runLabel: "demo" });
  tui.attach(runtime);

  await runtime.run({ messages: [userMessage("看看这个项目的改动")] });
  tui.detach();

  console.log(tui.snapshot());
}

main();