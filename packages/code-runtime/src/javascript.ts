import vm from "node:vm";
import ts from "typescript";
import type { CodeRuntime, RuntimeFailure, RuntimeResult, RuntimeSuccess } from "./runtime";

export type JavaScriptLanguage = "javascript" | "typescript";

export interface JavaScriptRuntimeOptions {
  /** 代码文本的语言；TypeScript 只做单文件转译，不做完整项目类型检查。 */
  language?: JavaScriptLanguage;
  /** 同步执行与未完成异步结果的最长等待时间。 */
  timeoutMs?: number;
}

interface CapturedOutput {
  stdout: string[];
  stderr: string[];
}

type RuntimeResultInput = Omit<RuntimeSuccess, "durationMs"> | Omit<RuntimeFailure, "durationMs">;

function render(value: unknown): string {
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function compileTypeScript(code: string): { ok: true; output: string } | { ok: false; error: string } {
  const compiled = ts.transpileModule(code, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
      strict: true,
    },
    reportDiagnostics: true,
  });
  const diagnostics = (compiled.diagnostics ?? []).filter((diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error);
  if (diagnostics.length > 0) {
    return {
      ok: false,
      error: diagnostics.map((diagnostic) => ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n")).join("\n"),
    };
  }
  return { ok: true, output: compiled.outputText };
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`代码执行超过 ${timeoutMs}ms`)), timeoutMs);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

/**
 * JavaScript / TypeScript 的最小参考实现。
 *
 * 此实现只给代码一个受限的 console；不注入 process、require、文件、网络或
 * Capability。node:vm 不是安全沙箱，不能用于执行不可信生产代码。
 */
export class JavaScriptRuntime implements CodeRuntime {
  private readonly language: JavaScriptLanguage;
  private readonly timeoutMs: number;

  constructor(options: JavaScriptRuntimeOptions = {}) {
    this.language = options.language ?? "typescript";
    this.timeoutMs = options.timeoutMs ?? 1_000;
  }

  async execute(code: string): Promise<RuntimeResult> {
    const startedAt = Date.now();
    const output: CapturedOutput = { stdout: [], stderr: [] };
    const finish = (result: RuntimeResultInput): RuntimeResult => {
      const durationMs = Date.now() - startedAt;
      return result.ok ? { ...result, durationMs } : { ...result, durationMs };
    };

    if (code.trim() === "") {
      return finish({ ok: false, stdout: "", stderr: "", error: "代码不能为空" });
    }

    const source = this.language === "typescript" ? compileTypeScript(code) : { ok: true as const, output: code };
    if (!source.ok) {
      return finish({ ok: false, stdout: "", stderr: "", error: `TypeScript 转译失败：${source.error}` });
    }

    const write = (target: string[]) => (...args: unknown[]) => target.push(args.map(render).join(" "));
    const context = vm.createContext(
      {
        console: {
          log: write(output.stdout),
          info: write(output.stdout),
          warn: write(output.stderr),
          error: write(output.stderr),
        },
      },
      { codeGeneration: { strings: false, wasm: false } },
    );

    try {
      const script = new vm.Script(`(async () => {\n"use strict";\n${source.output}\n})()`);
      const pending = script.runInContext(context, { timeout: this.timeoutMs });
      const value = await withTimeout(Promise.resolve(pending), this.timeoutMs);
      return finish({ ok: true, stdout: output.stdout.join("\n"), stderr: output.stderr.join("\n"), value });
    } catch (error) {
      return finish({
        ok: false,
        stdout: output.stdout.join("\n"),
        stderr: output.stderr.join("\n"),
        error: formatError(error),
      });
    }
  }

  async reset(): Promise<void> {
    // 本章是无状态、一次执行即丢弃的 context；Persistent Runtime 会在第 46 章覆写这一语义。
  }
}
