import type { Tool, ToolResult } from "./tool";
import { PermissionError, errorMessage } from "../errors/errors";
import type { Workspace } from "../workspace/workspace";

export const MAX_READ_CHARS = 8000;

export interface ReadInput {
  path?: unknown;
}

export function createReadTool(workspace: Workspace): Tool {

  return {
    name: "read",
    description: "读取 workspace 内的文本文件内容，path 为相对 workspace 根目录的路径；文件超长会自动截断",
    parameters: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "相对 workspace 根目录的文件路径，例如 src/index.ts",
        },
      },
      required: ["path"],
    },
    async execute(input: unknown): Promise<ToolResult> {
      const { path: filePath } = input as ReadInput;
      if (typeof filePath !== "string" || filePath.trim() === "") {
        return { ok: false, error: "参数 path 必须是文件路径字符串", kind: "tool", retryable: false };
      }

      try {
        workspace.resolve(filePath, "读取");

        if (await workspace.exists(filePath)) {
          if (!(await workspace.isFile(filePath))) {
            return { ok: false, error: `不是文件，无法读取：${filePath}`, kind: "tool", retryable: false };
          }
        }

        const content = await workspace.read(filePath);
        if (content.length <= MAX_READ_CHARS) {
          return { ok: true, value: content };
        }
        return {
          ok: true,
          value: `${content.slice(0, MAX_READ_CHARS)}\n\n...（已截断：文件共 ${content.length} 字符，只返回前 ${MAX_READ_CHARS} 字符）`,
        };
      } catch (error) {
        if (error instanceof PermissionError) {
          return { ok: false, error: error.message, kind: "permission", retryable: false };
        }
        const message = errorMessage(error);
        return { ok: false, error: `读取失败：${message}`, kind: "tool", retryable: false };
      }
    },
  };
}
