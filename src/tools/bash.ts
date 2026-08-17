import { spawn } from "node:child_process";
import type { Tool, ToolResult } from "../core/tool/tool";
import type { Workspace } from "../workspace/workspace";

export const MAX_OUTPUT_CHARS = 8000;

export interface BashInput {
  command?: unknown;
}

export interface BashResult {
  command: string;
  cwd: string;
  stdout: string;
  stderr: string;
  exitCode: number | null;
  timedOut: boolean;
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max)}\n...（已截断：输出超过 ${max} 字符）`;
}

export function createBashTool(workspace: Workspace, options: { timeoutMs?: number } = {}): Tool {
  const timeoutMs = options.timeoutMs ?? 10_000;

  return {
    name: "bash",
    description: "在 workspace 根目录下执行一条 shell 命令，返回 stdout / stderr / exitCode；命令必须非空，超时会强制终止",
    parameters: {
      type: "object",
      properties: {
        command: {
          type: "string",
          description: "要执行的 shell 命令，例如 node src/index.ts 或 npm test",
        },
      },
      required: ["command"],
    },
    async execute(input: unknown): Promise<ToolResult> {
      const { command } = input as BashInput;
      if (typeof command !== "string" || command.trim() === "") {
        return { ok: false, error: "参数 command 必须是字符串", kind: "tool", retryable: false };
      }

      return new Promise<ToolResult>((resolve) => {
        let stdout = "";
        let stderr = "";
        let timedOut = false;
        let settled = false;

        const child = spawn(command, { cwd: workspace.root, shell: true, windowsHide: true });

        const timer = setTimeout(() => {
          timedOut = true;
          child.kill("SIGKILL");
        }, timeoutMs);

        child.stdout.on("data", (chunk) => {
          stdout += chunk;
        });
        child.stderr.on("data", (chunk) => {
          stderr += chunk;
        });

        child.on("error", (error) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          resolve({ ok: false, error: `命令启动失败：${error.message}`, kind: "tool", retryable: false });
        });

        child.on("close", (code) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          resolve({
            ok: true,
            value: {
              command,
              cwd: workspace.root,
              stdout: truncate(stdout, MAX_OUTPUT_CHARS),
              stderr: truncate(stderr, MAX_OUTPUT_CHARS),
              exitCode: timedOut ? null : code,
              timedOut,
            },
          });
        });
      });
    },
  };
}
