import { execFile } from "node:child_process";
import type { Tool, ToolResult } from "../../src/core/tool/tool";
import type { Workspace } from "../../src/workspace/workspace";

const GIT_TIMEOUT_MS = 10_000;

export interface GitOutput {
  args: string[];
  cwd: string;
  stdout: string;
  stderr: string;
  exitCode: number;
}

function runGit(cwd: string, args: string[]): Promise<GitOutput> {
  return new Promise((resolve) => {
    execFile("git", args, { cwd, timeout: GIT_TIMEOUT_MS, maxBuffer: 1024 * 1024 }, (error, stdout, stderr) => {
      const code = (error as { code?: unknown } | null)?.code;
      resolve({
        args,
        cwd,
        stdout: String(stdout ?? ""),
        stderr: String(stderr ?? ""),
        exitCode: typeof code === "number" ? code : error ? 1 : 0,
      });
    });
  });
}

function createGitTool(workspace: Workspace, name: string, description: string, args: string[]): Tool {
  return {
    name,
    description,
    parameters: { type: "object", properties: {}, required: [] },
    async execute(): Promise<ToolResult> {
      const result = await runGit(workspace.root, args);
      if (result.exitCode !== 0) {
        return {
          ok: false,
          error: `git ${args.join(" ")} 失败（exitCode=${result.exitCode}）：${result.stderr || result.stdout || "未知错误"}`,
          kind: "tool",
          retryable: false,
        };
      }
      return { ok: true, value: result };
    },
  };
}

export function createGitTools(workspace: Workspace): Tool[] {
  return [
    createGitTool(
      workspace,
      "git_status",
      "只读：查看 workspace 当前未提交改动（git status --short）",
      ["status", "--short"],
    ),
    createGitTool(
      workspace,
      "git_log",
      "只读：查看最近 10 条提交记录（git log --oneline -10）",
      ["log", "--oneline", "-10"],
    ),
    createGitTool(
      workspace,
      "git_diff",
      "只读：查看工作区未提交改动的统计（git diff --stat）",
      ["diff", "--stat"],
    ),
  ];
}
