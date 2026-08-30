import { createRequire } from "node:module";
import path from "node:path";
import type { Tool, ToolResult, ToolRegistry } from "@hello-harness/core";
import type { Workspace } from "../workspace/workspace";
import { ProgrammaticToolBinding, ProgrammaticCallError } from "../programmatic/binding";

// 兼容 ch43 的导出：glob 的 pattern 解析已随真实 glob 工具迁到 ./glob
export { parseGlobPattern, globFiles } from "./glob";

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

// —— 注入给「模型程序」的能力运行时 ——
// 文件/命令类能力（glob / read / write / edit / bash）不再手写实现，全部经
// ProgrammaticToolBinding 走 ToolRegistry.execute：同一个权限门、同一个 workspace、
// 同一套超时与截断。只有 print / require / cwd 三个「非工具」能力留在注入面。
function createProgramRuntime(root: string, binding: ProgrammaticToolBinding) {
  const printed: string[] = [];

  // require 以 workspace 为基准解析（Node 内建模块 + workspace 内相对路径都可以被程序使用）
  const requireFromWorkspace = createRequire(path.join(root, "__hello_harness_program__.cjs"));

  return {
    printed,
    glob(pattern: string): Promise<string[]> {
      return binding.call("glob", { pattern });
    },
    read(relPath: string): Promise<string> {
      return binding.call("read", { path: relPath });
    },
    write(relPath: string, content: string): Promise<string> {
      return binding.call("write", { path: relPath, content });
    },
    edit(relPath: string, oldString: string, newString: string): Promise<string> {
      return binding.call("edit", { path: relPath, oldString, newString });
    },
    bash(command: string): Promise<unknown> {
      return binding.call("bash", { command });
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

export function createCodeActionTool(workspace: Workspace, registry: ToolRegistry): Tool {
  return {
    name: "code",
    description:
      "执行一段 JavaScript 程序（代码动作）：一次执行即可在程序内部循环、过滤、组合多次能力。程序里注入的能力全部绑定到已注册工具：glob(pattern)（匹配文件，返回相对路径）、read(path)、write(path, content)、edit(path, oldString, newString)、bash(command) 都走同一套 ToolRegistry + 权限门；另有 require(id)（加载 Node 内建模块或 workspace 内模块）、cwd()（workspace 根目录）与 print(内容)（输出结论，唯一进入上下文的结果）。适合把「遍历 → 过滤 → 聚合 → 汇总」这类组合任务一次写完。",
    parameters: {
      type: "object",
      properties: {
        code: {
          type: "string",
          description:
            "一段 JavaScript 程序文本，可使用 await；可直接调用 glob(pattern)、read(path)、write(path, content)、edit(path, oldString, newString)、bash(command)、require(id)、cwd()、print(内容)，循环/过滤/组合全部在程序内完成。不要写 import 语句（本执行面是函数作用域），需要模块用 require；拼绝对路径用注入的 cwd()，不要依赖 process.cwd()；不要带 ``` 围栏（会自动剥离）。程序里的写文件/编辑/执行命令会触发权限确认，被拒绝时按错误消息修正。",
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
      const binding = new ProgrammaticToolBinding(registry);
      const rt = createProgramRuntime(workspace.root, binding);
      const body = `return (async () => {\n${program}\n})();`;
      const messageOf = (error: unknown): string =>
        error instanceof Error ? error.message : String(error);

      let fn: (...args: unknown[]) => Promise<unknown>;
      try {
        fn = new Function("glob", "read", "write", "edit", "bash", "print", "require", "cwd", body) as (
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
          [fn(rt.glob, rt.read, rt.write, rt.edit, rt.bash, rt.print, rt.require, rt.cwd), timeoutPromise],
        );
      } catch (error) {
        if (error instanceof ProgrammaticCallError) {
          if (error.kind === "permission") {
            return { ok: false, error: error.message, kind: "permission", retryable: false };
          }
          return { ok: false, error: error.message, kind: "tool", retryable: false };
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
        value: { printed: rt.printed, calls: binding.calls },
      };
    },
  };
}