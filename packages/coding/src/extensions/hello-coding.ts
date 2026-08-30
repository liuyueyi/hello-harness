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
import { createSkillTool } from "../tools/skill";
import { createCodeActionTool } from "../tools/code";

export function createHelloCodingExtension(workspace: Workspace, options: { promptsDir?: string; skillsDir?: string } = {}) {
  return defineExtension({
    name: "hello-coding",
    version: "0.9.0",
    description: "Coding Agent 本体：8 个工具（calculator/random/read/write/edit/bash/load_skill/code）、prompt 模板、.skills/ 技能加载与技能目录注入均由扩展注册。",
    setup(ctx) {
      ctx.tools.register(calculator);
      ctx.tools.register(randomInteger);
      ctx.tools.register(createReadTool(workspace));
      ctx.tools.register(createWriteTool(workspace));
      ctx.tools.register(createEditTool(workspace));
      ctx.tools.register(createBashTool(workspace));
      ctx.tools.register(createSkillTool(ctx.skills));
      ctx.tools.register(createCodeActionTool(workspace));

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