import { readFileSync, readdirSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import type { Tool, ToolResult } from "@hello-harness/core";
import { PermissionError } from "@hello-harness/core";
import type { Workspace } from "../workspace/workspace";

export const CODE_ACTION_TIMEOUT_MS = 10_000;

export interface CodeActionInput {
  code?: unknown;
}

// 模型常把程序包进 Markdown 围栏，或残留首行语言标记——这里剥掉，避免编译期野错误
export function normalizeCode(code: string): string {
  let text = code.trim();
  const fence = /^```[a-zA-Z]*\s*\n?([\s\S]*?)\n?```\s*$/.exec(text);
  if (fence) text = fence[1].trim();
  return text;
}

function excerpt(code: string, max = 160): string {
  const single = code.replace(/\s*\n\s*/g, " ");
  return single.length <= max ? single : `${single.slice(0, max)}…`;
}

const SKIPPED_DIRS = new Set(["node_modules", ".git", ".sessions", ".harness", "dist"]);
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

// —— 注入给「模型程序」的能力：glob / read / print / require / cwd ——
function createProgramExec(root: string) {
  const calls: string[] = [];
  const printed: string[] = [];

  function isDirectory(target: string): boolean {
    return statSync(target).isDirectory();
  }

  // require 以 workspace 为基准解析（Node 内建模块 + workspace 内相对路径都可以被程序使用）
  const requireFromWorkspace = createRequire(path.join(root, "__hello_harness_program__.cjs"));

  return {
    calls,
    printed,
    glob(pattern: string): string[] {
      calls.push(`glob(${pattern})`);
      // 按「前缀目录 + 后缀集合」限定范围，并跳过 node_modules/.git 等业务无关目录
      const { rootDir, exts } = parseGlobPattern(pattern);
      const files: string[] = [];
      function walk(dir: string) {
        for (const entry of readdirSync(dir)) {
          if (SKIPPED_DIRS.has(entry)) continue;
          const full = path.join(dir, entry);
          if (isDirectory(full)) {
            walk(full);
          } else if (exts.size === 0 || exts.has(path.extname(entry).replace(/^\./, ""))) {
            files.push(path.relative(root, full).split(path.sep).join("/"));
          }
        }
      }
      walk(path.join(root, rootDir));
      return files;
    },
    async read(relPath: string): Promise<string> {
      calls.push(`read(${relPath})`);
      const target = path.resolve(root, relPath);
      if (target !== root && !target.startsWith(root + path.sep)) {
        throw new PermissionError(`程序 read 越界，拒绝：${relPath}`);
      }
      return readFileSync(target, "utf-8");
    },
    print(text: unknown): void {
      printed.push(typeof text === "string" ? text : JSON.stringify(text, null, 2));
    },
    require(id: string): unknown {
      return requireFromWorkspace(id);
    },
    cwd(): string {
      return root; // workspace 根目录；程序里拼绝对路径请用它，不要依赖 process.cwd()
    },
  };
}

export function createCodeActionTool(workspace: Workspace): Tool {
  return {
    name: "code",
    description:
      "执行一段 JavaScript 程序（代码动作）：一次执行即可在程序内部循环、过滤、组合多次能力。程序里可用注入的能力：glob(pattern)（按前缀目录与后缀集合匹配文件并返回相对路径，自动跳过 node_modules/.git/.sessions 等）、read(path)（读取 workspace 内文件）、require(id)（加载 Node 内建模块或 workspace 内模块）、cwd()（workspace 根目录，拼绝对路径用它）、print(内容)（输出结论，唯一进入上下文的结果）。适合把「遍历 → 过滤 → 聚合」这类组合任务一次写完。",
    parameters: {
      type: "object",
      properties: {
        code: {
          type: "string",
          description:
            "一段 JavaScript 程序文本，可使用 await；可直接调用 glob(pattern)、read(path)、require(id)、cwd()、print(内容)，循环/过滤/组合全部在程序内完成。不要写 import 语句（本执行面是函数作用域），需要模块用 require；拼绝对路径用注入的 cwd()，不要依赖 process.cwd()；不要带 ``` 围栏（会自动剥离）。",
        },
      },
      required: ["code"],
    },
    async execute(input: unknown): Promise<ToolResult> {
      const { code } = input as CodeActionInput;
      if (typeof code !== "string" || code.trim() === "") {
        return { ok: false, error: "参数 code 必须是程序文本字符串", kind: "tool", retryable: false };
      }

      const program = normalizeCode(code);
      const exec = createProgramExec(workspace.root);
      const body = `return (async () => {\n${program}\n})();`;
      const messageOf = (error: unknown): string =>
        error instanceof Error ? error.message : String(error);

      let fn: (...args: unknown[]) => Promise<unknown>;
      try {
        fn = new Function("glob", "read", "print", "require", "cwd", body) as (
          ...args: unknown[]
        ) => Promise<unknown>;
      } catch (error) {
        return {
          ok: false,
          error: `程序编译失败：${messageOf(error)}｜程序开头：${excerpt(program)}`,
          kind: "tool",
          retryable: false,
        };
      }

      let timer: ReturnType<typeof setTimeout> | undefined;
      const timeoutPromise = new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`程序执行超时（${CODE_ACTION_TIMEOUT_MS}ms）`)),
          CODE_ACTION_TIMEOUT_MS,
        );
      });

      try {
        await Promise.race(
          [fn(exec.glob, exec.read, exec.print, exec.require, exec.cwd), timeoutPromise],
        );
      } catch (error) {
        if (error instanceof PermissionError) {
          return { ok: false, error: error.message, kind: "permission", retryable: false };
        }
        return {
          ok: false,
          error: `程序执行失败：${messageOf(error)}｜程序开头：${excerpt(program)}`,
          kind: "tool",
          retryable: false,
        };
      } finally {
        if (timer) clearTimeout(timer);
      }

      return {
        ok: true,
        value: { printed: exec.printed, calls: exec.calls },
      };
    },
  };
}