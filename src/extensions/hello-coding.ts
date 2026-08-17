import { defineExtension } from "./extension";
import type { Workspace } from "../workspace/workspace";
import { PromptLoader } from "../prompt/prompt";
import { calculator } from "../tools/calculator";
import { randomInteger } from "../tools/random";
import { createReadTool } from "../tools/read";
import { createWriteTool } from "../tools/write";
import { createEditTool } from "../tools/edit";
import { createBashTool } from "../tools/bash";

export function createHelloCodingExtension(workspace: Workspace, options: { promptsDir?: string } = {}) {
  return defineExtension({
    name: "hello-coding",
    version: "0.5.0",
    description: "Coding Agent 本体：6 个工具（calculator/random/read/write/edit/bash）由扩展注册；方法论 prompt 从 prompts/*.md 加载。",
    setup(ctx) {
      ctx.tools.register(calculator);
      ctx.tools.register(randomInteger);
      ctx.tools.register(createReadTool(workspace));
      ctx.tools.register(createWriteTool(workspace));
      ctx.tools.register(createEditTool(workspace));
      ctx.tools.register(createBashTool(workspace));

      const loader = new PromptLoader(options.promptsDir ?? "prompts");
      for (const prompt of loader.loadSync()) {
        ctx.prompts.register(prompt);
      }
    },
  });
}