import { defineExtension } from "../../src/extensions";
import type { Workspace } from "../../src/workspace/workspace";
import { createGitTools } from "./git";

export function createGitExtension(workspace: Workspace) {
  return defineExtension({
    name: "git",
    version: "0.1.0",
    description: "独立发布的 Git 扩展包（@hello-harness/git）：只读 git 工具 git_status / git_log / git_diff，参数固定、不拼接任意命令",
    setup(ctx) {
      for (const tool of createGitTools(workspace)) {
        ctx.tools.register(tool);
      }
    },
  });
}

export default createGitExtension;
