import { readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Tool, ToolResult } from "./tool";

export interface EditInput {
  path?: unknown;
  oldString?: unknown;
  newString?: unknown;
}

function snippet(value: string, max = 40): string {
  const flat = value.replace(/\r?\n/g, "\\n");
  return flat.length <= max ? flat : `${flat.slice(0, max)}…`;
}

export function createEditTool(workspaceRoot: string): Tool {
  const root = path.resolve(workspaceRoot);

  return {
    name: "edit",
    description: "在 workspace 内文件中做精准 search / replace 替换：把恰好出现一次的 oldString 替换为 newString，其余内容保持不动；oldString 必须非空、且必须唯一",
    parameters: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "相对 workspace 根目录的文件路径，例如 src/index.ts",
        },
        oldString: {
          type: "string",
          description: "要替换的原文片段，必须非空、且在文件中恰好出现一次；不唯一时请包含更多上下文",
        },
        newString: {
          type: "string",
          description: "替换后的新内容，可为空字符串（表示删除该片段）",
        },
      },
      required: ["path", "oldString", "newString"],
    },
    async execute(input: unknown): Promise<ToolResult> {
      const { path: filePath, oldString, newString } = input as EditInput;
      if (typeof filePath !== "string" || filePath.trim() === "") {
        return { ok: false, error: "参数 path 必须是文件路径字符串", kind: "tool", retryable: false };
      }
      if (typeof oldString !== "string" || oldString === "") {
        return { ok: false, error: "参数 oldString 必须是非空字符串", kind: "tool", retryable: false };
      }
      if (typeof newString !== "string") {
        return { ok: false, error: "参数 newString 必须是字符串", kind: "tool", retryable: false };
      }

      const target = path.resolve(root, filePath);
      if (target !== root && !target.startsWith(root + path.sep)) {
        return {
          ok: false,
          error: `路径超出 workspace 范围，拒绝修改：${filePath}（解析后 ${target}）`,
          kind: "permission",
          retryable: false,
        };
      }

      try {
        const info = await stat(target);
        if (!info.isFile()) {
          return { ok: false, error: `不是文件，无法修改：${filePath}`, kind: "tool", retryable: false };
        }

        const content = await readFile(target, "utf-8");
        const count = content.split(oldString).length - 1;
        if (count === 0) {
          return {
            ok: false,
            error: `在 ${filePath} 中未找到 oldString，请先用 read 读取文件确认内容`,
            kind: "tool",
            retryable: false,
          };
        }
        if (count > 1) {
          return {
            ok: false,
            error: `oldString 在 ${filePath} 中出现了 ${count} 次，匹配不唯一；请提供更多上下文让 oldString 唯一`,
            kind: "tool",
            retryable: false,
          };
        }

        const updated = content.replace(oldString, newString);
        await writeFile(target, updated, "utf-8");

        return { ok: true, value: `已替换 1 处：${snippet(oldString)} → ${snippet(newString)}（${filePath}）` };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { ok: false, error: `修改失败：${message}`, kind: "tool", retryable: false };
      }
    },
  };
}
