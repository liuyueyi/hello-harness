import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { Workspace, createBashTool } from "@hello-harness/coding";
import { ToolRegistry, AgentRuntime, HookManager } from "@hello-harness/core";
import type { Model, ModelEvent, ModelRequest } from "@hello-harness/core";

const scratch = path.join(os.tmpdir(), "hltest4");
rmSync(scratch, { recursive: true, force: true });
mkdirSync(scratch, { recursive: true });
writeFileSync(path.join(scratch, "f.txt"), "hello", "utf-8");
execFileSync("git", ["init", "-b", "main"], { cwd: scratch, stdio: "ignore" });

const workspace = new Workspace(scratch);
const registry = new ToolRegistry();
registry.register(createBashTool(workspace));

const xml = [
  "<tool_call>",
  "<function=bash>",
  "<parameter=command>",
  'powershell -Command "Get-ChildItem -Path packages -Directory | Select-Object Name, LastWriteTime"',
  "</parameter>",
  "</function>",
  "</tool_call>",
  "<tool_call>",
  "<function=bash>",
  "<parameter=command>",
  'powershell -Command "Get-Item .\\packages\\cli -Recurse -File | Select-Object Name, LastWriteTime | Format-Table -HideTableHeaders"',
  "</parameter>",
  "</function>",
  "</tool_call>",
].join("\n");

const model: Model = {
  modelName: "m",
  async generate() {
    throw new Error("x");
  },
  async *stream(request: ModelRequest): AsyncIterable<ModelEvent> {
    if (!request.tools || request.tools.length === 0) {
      yield { type: "content", text: "已查看完成。" };
    } else {
      yield { type: "content", text: "我来查一下：\n" + xml };
      yield { type: "usage", inputTokens: 10, outputTokens: 10 };
    }
  },
};

async function main() {
  const runtime = new AgentRuntime(model, registry, {
    hooks: new HookManager(),
    streaming: true,
    maxSteps: 5,
  });
  let toolCount = 0;
  const cmds: string[] = [];
  runtime.events.on("tool:end", (e) => {
    if (e.call.name === "bash") {
      toolCount += 1;
      cmds.push((e.call.arguments as { command?: string })?.command ?? "");
    }
  });
  const run = await runtime.run({ messages: [{ role: "user", content: "继续" }] });
  console.error("STOP_REASON:", run.stopReason);
  console.error("TOOL_COUNT:", toolCount);
  console.error("TOOL_CMDS:", JSON.stringify(cmds));
  console.error("ANSWER_HAS_RAW_XML:", run.answer.includes("<tool_call>") ? "Y" : "N");
}

main();
