import { defineExtension } from "@hello-harness/extensions";
import path from "node:path";
import type { Workspace } from "../workspace/workspace";
import { PromptLoader } from "@hello-harness/extensions";
import { SkillLoader } from "@hello-harness/extensions";
import { calculator } from "../tools/calculator";
import { randomInteger } from "../tools/random";
import { createReadTool } from "../tools/read";
import { createWriteTool } from "../tools/write";
import { createEditTool } from "../tools/edit";
import { createBashTool } from "../tools/bash";
import { createGlobTool } from "../tools/glob";
import { createSkillTool } from "../tools/skill";
import { createCodeActionTool } from "../tools/code";
import { createTaskTool } from "../tools/task";
import type { AgentSpawner } from "../programmatic/spawner";

// ch47：扩展可以接收 AgentSpawner（由组装方注入，通常是 CLI 持有 Model 后再创建 AgentSpawner）。
// 扩展本身不持有模型——task 工具永远是可选能力，没注入时模型调用会得到清晰错误。
export interface HelloCodingExtensionOptions {
  promptsDir?: string;
  skillsDir?: string;
  spawner?: AgentSpawner;
}

export function createHelloCodingExtension(workspace: Workspace, options: HelloCodingExtensionOptions = {}) {
  return defineExtension({
    name: "hello-coding",
    version: "0.12.0",
    description: "Coding Agent 本体：10 个工具（calculator/random/read/write/edit/bash/load_skill/code/glob + task（ch47 子 Agent））、prompt 模板、.skills/ 技能加载与技能目录注入均由扩展注册。",
    setup(ctx) {
      ctx.tools.register(calculator);
      ctx.tools.register(randomInteger);
      ctx.tools.register(createReadTool(workspace));
      ctx.tools.register(createWriteTool(workspace));
      ctx.tools.register(createEditTool(workspace));
      ctx.tools.register(createBashTool(workspace));
      ctx.tools.register(createSkillTool(ctx.skills));
      ctx.tools.register(createCodeActionTool(workspace, ctx.tools));
      ctx.tools.register(createGlobTool(workspace));
      if (options.spawner) {
        ctx.tools.register(createTaskTool(options.spawner));
      }

      const promptLoader = new PromptLoader(path.resolve(workspace.root, options.promptsDir ?? "prompts"));
      for (const prompt of promptLoader.loadSync()) {
        ctx.prompts.register(prompt);
      }

      const skillLoader = new SkillLoader(path.resolve(workspace.root, options.skillsDir ?? ".skills"));
      for (const skill of skillLoader.loadSync()) {
        ctx.skills.register(skill);
      }
    },
  });
}
