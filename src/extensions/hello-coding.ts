import { defineExtension } from "./extension";
import type { Workspace } from "../workspace/workspace";
import { PromptLoader } from "../prompt/prompt";
import { SkillLoader } from "../skill/loader";
import { calculator } from "../tools/calculator";
import { randomInteger } from "../tools/random";
import { createReadTool } from "../tools/read";
import { createWriteTool } from "../tools/write";
import { createEditTool } from "../tools/edit";
import { createBashTool } from "../tools/bash";

export function createHelloCodingExtension(workspace: Workspace, options: { promptsDir?: string; skillsDir?: string } = {}) {
  return defineExtension({
    name: "hello-coding",
    version: "0.7.0",
    description: "Coding Agent 本体：6 个工具（calculator/random/read/write/edit/bash）、prompt 模板与标准 .skills/ 技能（scripts/references/assets）均由扩展注册。",
    setup(ctx) {
      ctx.tools.register(calculator);
      ctx.tools.register(randomInteger);
      ctx.tools.register(createReadTool(workspace));
      ctx.tools.register(createWriteTool(workspace));
      ctx.tools.register(createEditTool(workspace));
      ctx.tools.register(createBashTool(workspace));

      const promptLoader = new PromptLoader(options.promptsDir ?? "prompts");
      for (const prompt of promptLoader.loadSync()) {
        ctx.prompts.register(prompt);
      }

      const skillLoader = new SkillLoader(options.skillsDir ?? ".skills");
      for (const skill of skillLoader.loadSync()) {
        ctx.skills.register(skill);
      }
    },
  });
}