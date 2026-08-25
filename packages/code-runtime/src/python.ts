import { spawn } from "node:child_process";
import type { CodeRuntime, RuntimeFailure, RuntimeResult, RuntimeSuccess } from "./runtime";

export interface PythonRuntimeOptions {
  /** 子进程入口命令；默认优先 `python3`，失败再回退 `python`。 */
  command?: string;
  /** 单段 Code Action 最长执行时间，超时直接杀掉子进程。 */
  timeoutMs?: number;
}

const RESULT_MARKER = "__HARNESS_RESULT__";

type RuntimeResultInput = Omit<RuntimeSuccess, "durationMs"> | Omit<RuntimeFailure, "durationMs">;

type RunOutcome =
  | { kind: "spawn-error"; message: string }
  | { kind: "ok" }
  | { kind: "timeout" }
  | { kind: "exit"; code: number };

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function buildScript(userCode: string): string {
  const indented = userCode
    .split("\n")
    .map((line) => (line.length > 0 ? "    " + line : line))
    .join("\n");

  return [
    "import json, sys",
    "def __hr_main__():",
    indented,
    "__hr_result = None",
    "try:",
    "    __hr_result = __hr_main__()",
    "except BaseException as __hr_e:",
    "    import traceback",
    "    traceback.print_exc()",
    "    sys.exit(1)",
    `sys.stdout.write("\\n${RESULT_MARKER}" + json.dumps(__hr_result))`,
  ].join("\n");
}

function splitResult(rawStdout: string): { stdout: string; value: unknown } {
  const markerIndex = rawStdout.indexOf(RESULT_MARKER);
  if (markerIndex === -1) return { stdout: rawStdout, value: undefined };
  const stdout = rawStdout.slice(0, markerIndex).replace(/\n$/, "");
  const payload = rawStdout.slice(markerIndex + RESULT_MARKER.length);
  let value: unknown = undefined;
  try {
    value = JSON.parse(payload);
  } catch {
    value = undefined;
  }
  return { stdout, value };
}

function extractError(stderr: string, code: number): string {
  const lines = stderr.split("\n").map((line) => line.trim()).filter(Boolean);
  const last = lines[lines.length - 1];
  return last ? last : `Python 进程以退出码 ${code} 结束`;
}

function runProcess(command: string, script: string, timeoutMs: number, output: { stdout: string; stderr: string }): Promise<RunOutcome> {
  return new Promise((resolve) => {
    let settled = false;
    const done = (outcome: RunOutcome) => {
      if (settled) return;
      settled = true;
      resolve(outcome);
    };

    const child = spawn(command, ["-X", "utf8", "-c", script], {
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, PYTHONIOENCODING: "utf-8" },
    });

    const timer = setTimeout(() => {
      done({ kind: "timeout" });
      child.kill("SIGKILL");
    }, timeoutMs);

    child.stdout?.setEncoding("utf8").on("data", (chunk: string) => {
      output.stdout += chunk;
    });
    child.stderr?.setEncoding("utf8").on("data", (chunk: string) => {
      output.stderr += chunk;
    });

    child.on("error", (error) => {
      clearTimeout(timer);
      done({ kind: "spawn-error", message: formatError(error) });
    });

    child.on("close", (code) => {
      clearTimeout(timer);
      if (!settled) {
        if (code === 0) done({ kind: "ok" });
        else done({ kind: "exit", code: code ?? 1 });
      }
    });
  });
}

/**
 * 用 Python 子进程执行模型生成的 Code Action 的参考实现。
 *
 * 这一版是「一次执行，一次退出」：每段代码起一个全新的解释器进程，结束后变量
 * 不保留（持久状态留给第 46 章 Persistent Runtime）。子进程的 stdout / stderr /
 * 退出状态被翻译回统一的 `RuntimeResult`。
 *
 * 为了让模型像 TypeScript 那样用 `return` 返回结构化结果，宿主把用户代码包进
 * `__hr_main__()` 再调用，并在末尾用哨兵行 `__HARNESS_RESULT__<json>` 把返回值
 * 写回 stdout；执行成功后我们从 stdout 里剥掉这一行，剩下的交给上层。
 */
export class PythonRuntime implements CodeRuntime {
  private readonly command?: string;
  private readonly timeoutMs: number;

  constructor(options: PythonRuntimeOptions = {}) {
    this.command = options.command;
    this.timeoutMs = options.timeoutMs ?? 1_000;
  }

  async execute(code: string): Promise<RuntimeResult> {
    const startedAt = Date.now();
    const output = { stdout: "", stderr: "" };
    const finish = (result: RuntimeResultInput): RuntimeResult => ({
      ...result,
      durationMs: Date.now() - startedAt,
    });

    if (code.trim() === "") {
      return finish({ ok: false, stdout: "", stderr: "", error: "代码不能为空" });
    }

    const script = buildScript(code);
    const commands = this.command ? [this.command] : ["python3", "python"];

    for (const command of commands) {
      const outcome = await runProcess(command, script, this.timeoutMs, output);

      if (outcome.kind === "spawn-error") {
        if (command === commands[commands.length - 1]) {
          return finish({ ok: false, stdout: "", stderr: "", error: `找不到可用的 Python 解释器：${outcome.message}` });
        }
        continue;
      }

      if (outcome.kind === "ok") {
        const { stdout, value } = splitResult(output.stdout);
        return finish({ ok: true, stdout, stderr: output.stderr, value });
      }

      if (outcome.kind === "timeout") {
        return finish({ ok: false, stdout: output.stdout, stderr: output.stderr, error: `Python 执行超过 ${this.timeoutMs}ms，已强制终止子进程` });
      }

      return finish({ ok: false, stdout: output.stdout, stderr: output.stderr, error: extractError(output.stderr, outcome.code) });
    }

    return finish({ ok: false, stdout: "", stderr: "", error: "找不到可用的 Python 解释器" });
  }

  async reset(): Promise<void> {
    // 本章是一次性子进程，执行结束进程即退出；Persistent Runtime 会在第 46 章覆写这一语义。
  }
}
