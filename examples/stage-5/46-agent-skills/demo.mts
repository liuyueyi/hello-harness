/**
 * 46 · Agent Skills：使用真实 Skill 完成可验证工作流
 *
 * internal-comms 来自 examples/stage-4/35-skill-loader/fixtures，它是
 * Anthropic skills 官方仓库中的真实 Skill 快照（Apache-2.0）。本 demo
 * 不重新实现 Skill，而是演示一个外部 Skill 如何被 Harness 消费：
 * discover → load → 按需读取 examples/ 资源 → 调用既有 write/read → verify。
 */

import {
  AgentRuntime,
  HookManager,
  ToolRegistry,
  type Model,
  type ModelEvent,
  type ModelRequest,
  type ModelResponse,
} from "@hello-harness/core";
import {
  SkillLoader,
  SkillRegistry,
  injectSkillCatalog,
  renderSkillCatalog,
} from "@hello-harness/extensions";
import {
  SkillHost,
  Workspace,
  createEditTool,
  createReadSkillResourceTool,
  createReadTool,
  createRunSkillScriptTool,
  createSkillTool,
  createWriteTool,
} from "@hello-harness/coding";
import { rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..", "..", "..");
const thirdPartySkillRoot = path.join(
  repoRoot,
  "examples",
  "stage-4",
  "35-skill-loader",
  "fixtures",
);
const outputPath = "examples/stage-5/46-agent-skills/scratch/weekly-update.md";

class DeterministicSkillModel implements Model {
  readonly modelName = "stage-5-skill-consumer-demo";
  private step = 0;

  async generate(request: ModelRequest): Promise<ModelResponse> {
    const latestTool = [...request.messages].reverse().find((message) => message.role === "tool");
    const hasThreePFormat = latestTool?.role === "tool"
      && latestTool.content.includes("Progress")
      && latestTool.content.includes("Plans")
      && latestTool.content.includes("Problems");
    const reportContent = hasThreePFormat
      ? "🛠️ Harness Team (2026-09-01–2026-09-07)\nProgress: 完成 Skill Host，新增 2 个受治理的资源访问工具。\nPlans: 为 ch47 准备 Agent as Function 的最小接口。\nProblems: 文档构建仍受本地依赖镜像权限限制。"
      : "无法从 Skill 资源确认 3P 格式，停止生成。";
    const responses: ModelResponse[] = [
      {
        content: "这个任务是内部沟通写作，我先加载 internal-comms Skill。",
        toolCalls: [{ id: "call-1", name: "load_skill", arguments: { name: "internal-comms" } }],
        inputTokens: 30,
        outputTokens: 12,
      },
      {
        content: "Skill 要求先读取对应沟通类型的模板，我读取 3P 更新规范。",
        toolCalls: [{
          id: "call-2",
          name: "read_skill_resource",
          arguments: { skill: "internal-comms", path: "examples/3p-updates.md" },
        }],
        inputTokens: 70,
        outputTokens: 18,
      },
      {
        content: "我按照资源中的严格格式生成一份简短、数据驱动的周报。",
        toolCalls: [{
          id: "call-3",
          name: "write",
          arguments: {
            path: outputPath,
            content: reportContent,
          },
        }],
        inputTokens: 90,
        outputTokens: 25,
      },
      {
        content: "最后回读产物，确认 Skill 要求的三段格式都存在。",
        toolCalls: [{ id: "call-4", name: "read", arguments: { path: outputPath } }],
        inputTokens: 60,
        outputTokens: 15,
      },
      {
        content: "Skill 消费流程完成：外部 Skill 提供工作流和参考资料，环境修改仍由既有工具完成。",
        toolCalls: [],
        inputTokens: 65,
        outputTokens: 20,
      },
    ];
    return responses[Math.min(this.step++, responses.length - 1)];
  }

  async *stream(_request: ModelRequest): AsyncIterable<ModelEvent> {
    // 保留 Model 契约；本例使用 generate 让每个工作流步骤更容易观察。
  }
}

async function main(): Promise<void> {
  const skills = new SkillRegistry();
  for (const skill of new SkillLoader(thirdPartySkillRoot).loadSync()) {
    skills.register(skill);
  }

  const catalog = renderSkillCatalog(skills.list());
  console.log("=== 46 · Skill 消费流程 ===");
  console.log("来源：Anthropic skills 官方仓库的 internal-comms 快照（Apache-2.0）");
  console.log(catalog);
  console.log(`资源文件：${skills.get("internal-comms")?.resources?.join(" / ")}`);

  const workspace = new Workspace(repoRoot);
  const tools = new ToolRegistry();
  tools.register(createReadTool(workspace));
  tools.register(createWriteTool(workspace));
  tools.register(createEditTool(workspace));
  const host = new SkillHost(skills, tools, workspace);
  tools.register(createReadSkillResourceTool(host));
  tools.register(createRunSkillScriptTool(host));
  tools.register(createSkillTool(skills, { onLoad: (skill) => host.markLoaded(skill.name) }));

  const runtime = new AgentRuntime(new DeterministicSkillModel(), tools, {
    maxSteps: 8,
    hooks: new HookManager(),
  });
  runtime.on("tool:end", (event) => {
    console.log(`[tool:end] ${event.call.name} -> ${event.result.ok ? "ok" : "error"}`);
  });

  const system = injectSkillCatalog(
    "你是一个 Coding Agent。先选择适合的 Skill，再按其工作流调用宿主能力。",
    catalog,
  );
  const run = await runtime.run({
    messages: [
      { role: "system", content: system },
      { role: "user", content: "请根据本周 Harness 项目进展写一份 3P 周报。" },
    ],
  });

  const output = await workspace.read(outputPath);
  const valid = ["Progress:", "Plans:", "Problems:"].every((section) => output.includes(section));
  console.log("\n=== 运行结果 ===");
  console.log(`status=${run.status}, stopReason=${run.stopReason}`);
  console.log(`answer=${run.answer}`);
  console.log(`[skill:verify] internal-comms 3P 格式 -> ${valid ? "pass" : "fail"}`);

  const traversal = await tools.execute({
    id: "security-check",
    name: "read_skill_resource",
    arguments: { skill: "internal-comms", path: "../LICENSE.txt" },
  });
  console.log(`[skill:security] 目录穿越 -> ${traversal.ok ? "错误放行" : "拒绝（符合预期）"}`);

  // demo 不留下生成文件；真实宿主应把候选产物交给后续审批或版本化流程。
  await rm(path.join(repoRoot, "examples", "stage-5", "46-agent-skills", "scratch"), {
    recursive: true,
    force: true,
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
