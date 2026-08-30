import type { Tool, ToolResult } from "@hello-harness/core";
import { errorMessage } from "@hello-harness/core";
import { readdirSync, statSync } from "node:fs";
import path from "node:path";
import type { Workspace } from "../workspace/workspace";

export const SKIPPED_DIRS = new Set(["node_modules", ".git", ".sessions", ".harness", "dist"]);

const GLOB_BRACE_RE = /\{([^}]*)\}/;
const GLOB_EXT_RE = /\.[^.}+*]+$/;

// glob 模式解析：提取「前缀目录」（如 docs）与「后缀集合」（如 md,txt,json,js,ts）
export function parseGlobPattern(pattern: string): { rootDir: string; exts: Set<string> } {
  const brace = GLOB_BRACE_RE.exec(pattern);
  const exts = new Set(
    (brace ? brace[1].split(",") : [GLOB_EXT_RE.exec(pattern)?.[0].slice(1) ?? ""])
      .map((s) => s.replace(/\./g, "").trim())
      .filter(Boolean),
  );
  const firstSegment = pattern.split("/")[0];
  const rootDir = firstSegment && !firstSegment.includes("*") ? firstSegment : "";
  return { rootDir, exts };
}

// 在 workspace 内按「前缀目录 + 后缀集合」递归收集文件，返回相对根目录的路径
export function globFiles(root: string, pattern: string): string[] {
  const { rootDir, exts } = parseGlobPattern(pattern);
  const files: string[] = [];
  function walk(dir: string) {
    for (const entry of readdirSync(dir)) {
      if (SKIPPED_DIRS.has(entry)) continue;
      const full = path.join(dir, entry);
      if (statSync(full).isDirectory()) {
        walk(full);
      } else if (exts.size === 0 || exts.has(path.extname(entry).replace(/^\./, ""))) {
        files.push(path.relative(root, full).split(path.sep).join("/"));
      }
    }
  }
  walk(path.join(root, rootDir));
  return files;
}

export interface GlobInput {
  pattern?: unknown;
}

// glob 是只读能力，注册进 ToolRegistry 后，模型程序里的 glob(pattern) 也是通过它执行
export function createGlobTool(workspace: Workspace): Tool {
  return {
    name: "glob",
    description:
      "按 glob 模式列出 workspace 内的文件路径：前缀目录限定范围，后缀集合（如 {ts,md}）过滤类型，自动跳过 node_modules/.git/.sessions 等目录，返回相对 workspace 根目录的路径",
    parameters: {
      type: "object",
      properties: {
        pattern: {
          type: "string",
          description: "glob 模式，例如 src/**/*.ts、docs/**/*.md 或 **/*.{ts,js}",
        },
      },
      required: ["pattern"],
    },
    async execute(input: unknown): Promise<ToolResult> {
      const { pattern } = input as GlobInput;
      if (typeof pattern !== "string" || pattern.trim() === "") {
        return { ok: false, error: "参数 pattern 必须是非空字符串", kind: "tool", retryable: false };
      }
      try {
        const files = globFiles(workspace.root, pattern);
        return { ok: true, value: files };
      } catch (error) {
        const message = errorMessage(error);
        return { ok: false, error: `glob 执行失败：${message}`, kind: "tool", retryable: false };
      }
    },
  };
}