import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Tool, ToolResult } from "./tool";

export interface WriteInput {
  path?: unknown;
  content?: unknown;
}

export function createWriteTool(workspaceRoot: string): Tool {
  const root = path.resolve(workspaceRoot);

  return {
    name: "write",
    description: "把 content 完整写入 workspace 内的文件（path 为相对 workspace 根目录的路径）；父目录自动创建，已有文件会被覆盖",
    parameters: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "相对 workspace 根目录的文件路径，例如 src/index.ts",
        },
        content: {
          type: "string",
          description: "要写入的完整文件内容",
        },
      },
      required: ["path", "content"],
    },
    async execute(input: unknown): Promise<ToolResult> {
      const { path: filePath, content } = input as WriteInput;
      if (typeof filePath !== "string" || filePath.trim() === "") {
        return { ok: false, error: "参数 path 必须是文件路径字符串", kind: "tool", retryable: false };
      }
      if (typeof content !== "string") {
        return { ok: false, error: "参数 content 必须是字符串", kind: "tool", retryable: false };
      }

      const target = path.resolve(root, filePath);
      if (target !== root && !target.startsWith(root + path.sep)) {
        return {
          ok: false,
          error: `路径超出 workspace 范围，拒绝写入：${filePath}（解析后 ${target}）`,
          kind: "permission",
          retryable: false,
        };
      }

      try {
        const info = await stat(target).catch(() => null);
        let overwritten = false;
        let unchanged = false;

        if (info) {
          if (info.isDirectory()) {
            return { ok: false, error: `目标是一个目录，无法写入：${filePath}`, kind: "tool", retryable: false };
          }
          const existing = await readFile(target, "utf-8").catch(() => null);
          if (existing === content) {
            unchanged = true;
          } else {
            overwritten = true;
          }
        }

        if (!unchanged) {
          await mkdir(path.dirname(target), { recursive: true });
          await writeFile(target, content, "utf-8");
        }

        const verb = unchanged ? "内容未变化" : overwritten ? "覆盖已有文件" : "新建文件";
        return { ok: true, value: `已写入 ${filePath}（${content.length} 字符，${verb}）` };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { ok: false, error: `写入失败：${message}`, kind: "tool", retryable: false };
      }
    },
  };
}
