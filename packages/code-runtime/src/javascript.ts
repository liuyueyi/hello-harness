import vm from "node:vm";
import ts from "typescript";
import type { CodeRuntime, RuntimeFailure, RuntimeResult, RuntimeState, RuntimeStateEntry, RuntimeSuccess } from "./runtime";
import { emptyRuntimeState } from "./runtime";
import type { Capability } from "./capability";

export type JavaScriptLanguage = "javascript" | "typescript";

export interface JavaScriptRuntimeOptions {
  /** 代码文本的语言；TypeScript 只做单文件转译，不做完整项目类型检查。 */
  language?: JavaScriptLanguage;
  /** 同步执行与未完成异步结果的最长等待时间。 */
  timeoutMs?: number;
  /** 注入给代码执行环境的 Capability 集合。 */
  capabilities?: Capability[];
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
      // 关闭 strict 以避免 TS 在产物顶部注入 "use strict"；
      // 否则裸赋值（如 `x = 1`）会被当作严格模式下的隐式全局而抛 ReferenceError，
      // 而我们需要裸赋值落到持久 context 的全局对象上，跨越单元格保留。
      strict: false,
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

/** describe() 在内核里运行的小探针：枚举 globalThis 自有属性的名字 / 类型 / 截断预览。 */
const DESCRIBE_SNIPPET = `
  Object.getOwnPropertyNames(globalThis).map(function (n) {
    var v;
    try { v = globalThis[n]; } catch (e) { return { name: n, type: "unknown", preview: "<unreadable>" }; }
    var t = v === null ? "null" : Array.isArray(v) ? "array" : typeof v;
    var p;
    try {
      p = JSON.stringify(v);
      if (p === undefined) p = String(v);
    } catch (e) {
      try { p = String(v); } catch (e2) { p = "<unstringifiable>"; }
    }
    if (p.length > 80) p = p.slice(0, 77) + "...";
    return { name: n, type: t, preview: p };
  })
`;

/**
 * JavaScript / TypeScript 的持久内核（Persistent Kernel）参考实现。
 *
 * 与第 45 章「一次执行即丢弃 context」不同，本章把 context 在多次 `execute`
 * 之间保留下来：第一次 `execute` 时创建 `vm.Context`，之后复用同一个 context，
 * 因此**顶层 `var` / 函数声明 / 裸赋值（无 let/const/var 的赋值）会跨单元格保留**。
 *
 * 具体语义：
 * - 每个单元格的代码被包进 `(async () => { ... })()` 运行，因此**顶层 `await` 与
 *   `return` 仍然可用**（与第 45 章能力演示完全兼容）；
 * - 由于运行在非严格模式的 IIFE 中，裸赋值 `project = ...` 会落到 context 的全局
 *   对象上，从而在下一次 `execute` 时依然可见——这就是「持久内核」；
 * - `const` / `let` / `var` 声明的变量是单元格局部的，不会跨单元格保留（如需保留请用
 *   裸赋值或 `globalThis.x = ...`）；
 * - `reset()` 会丢弃整个 context，下一次 `execute` 从空白内核重新开始。
 *
 * 此实现只给代码一个受限的 console + 可选的 Capability；不注入 process、require、文件、网络。
 * node:vm 不是安全沙箱，不能用于执行不可信生产代码。
 */export class JavaScriptRuntime implements CodeRuntime {
  private readonly language: JavaScriptLanguage;
  private readonly timeoutMs: number;
  private readonly capabilities: Capability[];

  /** 持久内核：多次 execute 复用同一个 vm.Context。 */
  private context: vm.Context | null = null;
  /** 内核创建时的全局属性基线（JS 内建 + console + Capability 命名），describe() 据此过滤出模型创建的变量。 */
  private baseline: Set<string> | null = null;
  /** 当前单元格的输出缓冲（每次 execute 重置）。 */
  private output: CapturedOutput = { stdout: [], stderr: [] };

  constructor(options: JavaScriptRuntimeOptions = {}) {
    this.language = options.language ?? "typescript";
    this.timeoutMs = options.timeoutMs ?? 1_000;
    this.capabilities = options.capabilities ?? [];
  }

  private ensureKernel(): void {
    if (this.context) return;

    const write = (target: "stdout" | "stderr") => (...args: unknown[]) => {
      this.output[target].push(args.map(render).join(" "));
    };

    const contextObj: Record<string, unknown> = {
      console: {
        log: write("stdout"),
        info: write("stdout"),
        warn: write("stderr"),
        error: write("stderr"),
      },
    };

    // 注入 Capability 为全局命名空间：fs、shell 等，只在内核创建时注入一次。
    for (const cap of this.capabilities) {
      const namespace: Record<string, Function> = {};
      for (const [actionName, handler] of Object.entries(cap.actions)) {
        namespace[actionName] = async (args: unknown) => {
          try {
            return await handler(args);
          } catch (e) {
            throw new Error(`[${cap.name}.${actionName}] ${formatError(e)}`);
          }
        };
      }
      contextObj[cap.name] = namespace;
    }

    this.context = vm.createContext(contextObj, {
      codeGeneration: { strings: false, wasm: false },
    });

    // 记录内核初始全局属性：内建对象 + console + Capability 命名空间。
    // 之后 describe() 只报告「多出来的」部分，即模型亲手创建的变量。
    const names = new vm.Script("Object.getOwnPropertyNames(globalThis).join('\\n')", { filename: "baseline" })
      .runInContext(this.context, { timeout: this.timeoutMs }) as string;
    this.baseline = new Set(names.split("\n"));
  }

  async execute(code: string): Promise<RuntimeResult> {
    const startedAt = Date.now();
    const finish = (result: RuntimeResultInput): RuntimeResult => ({
      ...result,
      durationMs: Date.now() - startedAt,
    });

    if (code.trim() === "") {
      return finish({ ok: false, stdout: "", stderr: "", error: "代码不能为空" });
    }

    this.ensureKernel();

    const source = this.language === "typescript" ? compileTypeScript(code) : { ok: true as const, output: code };
    if (!source.ok) {
      return finish({ ok: false, stdout: "", stderr: "", error: `TypeScript 转译失败：${source.error}` });
    }

    // 复用持久 context；每次执行前清空输出缓冲。
    this.output = { stdout: [], stderr: [] };

    try {
      // 非严格模式 IIFE：支持顶层 await / return，且裸赋值会落到 context 全局对象上。
      const wrapped = `(async () => {\n${source.output}\n})()`;
      const script = new vm.Script(wrapped, { filename: "cell" });
      const pending = script.runInContext(this.context!, { timeout: this.timeoutMs });
      const value = await withTimeout(Promise.resolve(pending), this.timeoutMs);
      return finish({
        ok: true,
        stdout: this.output.stdout.join("\n"),
        stderr: this.output.stderr.join("\n"),
        value,
      });
    } catch (error) {
      return finish({
        ok: false,
        stdout: this.output.stdout.join("\n"),
        stderr: this.output.stderr.join("\n"),
        error: formatError(error),
      });
    }
  }

  /**
   * 描述内核当前的 Runtime State。
   *
   * 在持久 context 里跑一段只读探针，枚举 globalThis 的自有属性，
   * 减去内核创建时的基线（内建 + console + Capability），剩下的就是
   * 模型跨单元格攒下来的变量。context 不存在时返回「无内核」摘要。
   */
  async describe(): Promise<RuntimeState> {
    if (!this.context || !this.baseline) return emptyRuntimeState();
    try {
      const raw = new vm.Script(DESCRIBE_SNIPPET, { filename: "describe" }).runInContext(this.context, {
        timeout: this.timeoutMs,
      }) as RuntimeStateEntry[];
      const variables = raw
        .filter((entry) => !this.baseline!.has(entry.name) && !entry.name.startsWith("__"))
        .map((entry) => ({ name: entry.name, type: entry.type, preview: entry.preview }));
      return { alive: true, variables };
    } catch {
      // 探针本身失败（如内核被破坏）时按「活着但看不见」处理，绝不影响 execute 主路径。
      return { alive: true, variables: [] };
    }
  }

  async reset(): Promise<void> {
    // 丢弃持久内核；下一次 execute 会重新从空白 context 开始。
    this.context = null;
    this.baseline = null;
  }
}
