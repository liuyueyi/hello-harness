import { spawn } from "node:child_process";
import type { CodeRuntime, RuntimeFailure, RuntimeResult, RuntimeSuccess } from "./runtime";
import type { Capability } from "./capability";

export interface PythonRuntimeOptions {
  /** 子进程入口命令；默认优先 `python3`，失败再回退 `python`。 */
  command?: string;
  /** 单段 Code Action 最长执行时间，超时直接杀掉子进程。 */
  timeoutMs?: number;
  /** 注入给代码执行环境的 Capability 集合。 */
  capabilities?: Capability[];
}

const RESULT_MARKER = "__HARNESS_RESULT__";
const CAP_MARKER = "__HARNESS_CAP__";

type RuntimeResultInput = Omit<RuntimeSuccess, "durationMs"> | Omit<RuntimeFailure, "durationMs">;

type RunOutcome =
  | { kind: "spawn-error"; message: string }
  | { kind: "ok" }
  | { kind: "timeout" }
  | { kind: "exit"; code: number };

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** 生成包含 capability bridge 的 Python 脚本包装器 */
function buildScript(userCode: string, capabilities: Capability[]): string {
  const indented = userCode
    .split("\n")
    .map((line) => (line.length > 0 ? "    " + line : line))
    .join("\n");

  // Build capability manifest for the child
  const manifest = capabilities.map(cap => [cap.name, Object.keys(cap.actions)]);
  const manifestJson = JSON.stringify(manifest);

  return [
    "import json, sys",
    "",
    "# --- Capability Bridge ---",
    "__hr_cap_id = 0",
    "__hr_pending = {}",
    "",
    "def __hr_cap_call(capability: str, action: str, args):",
    "    global __hr_cap_id",
    "    __hr_cap_id += 1",
    "    req_id = __hr_cap_id",
    "    # Write request to stdout with marker",
    "    req = json.dumps({'id': req_id, 'capability': capability, 'action': action, 'args': args})",
    "    sys.stdout.write('\\n" + CAP_MARKER + "' + req + '\\n')",
    "    sys.stdout.flush()",
    "    # Read reply from stdin",
    "    line = sys.stdin.readline()",
    "    if not line:",
    "        raise RuntimeError('Capability bridge: EOF from host')",
    "    try:",
    "        reply = json.loads(line.strip())",
    "    except json.JSONDecodeError as e:",
    "        raise RuntimeError(f'Capability bridge: invalid reply: {e}')",
    "    if not reply.get('ok', False):",
    "        raise RuntimeError(f\"[{capability}.{action}] {reply.get('error', 'Unknown error')}\")",
    "    return reply.get('value')",
    "",
    "# Inject capability namespaces as globals",
    "import types",
    "for cap_name, actions in " + manifestJson + ":",
    "    ns = types.SimpleNamespace()",
    "    for act in actions:",
    "        setattr(ns, act, lambda *a, _c=cap_name, _a=act, **kw: __hr_cap_call(_c, _a, a[0] if a else (kw or {})))",
    "    globals()[cap_name] = ns",
    "",
    "def __hr_main__():",
    indented,
    "",
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

/**
 * 交互式运行 Python 子进程，支持 capability bridge。
 * 返回 async generator 的第一个值（最终结果），同时处理 capability 请求。
 */
async function runProcess(
  command: string,
  script: string,
  timeoutMs: number,
  _capabilities: Capability[],
  capHandlers: Map<string, Map<string, (args: unknown) => Promise<unknown>>>,
  output: { stdout: string; stderr: string }
): Promise<RunOutcome> {
  return new Promise((resolve) => {
    let settled = false;
    const done = (outcome: RunOutcome) => {
      if (settled) return;
      settled = true;
      resolve(outcome);
    };

    const child = spawn(command, ["-X", "utf8", "-c", script], {
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env, PYTHONIOENCODING: "utf-8" },
    });

    const timer = setTimeout(() => {
      done({ kind: "timeout" });
      child.kill("SIGKILL");
    }, timeoutMs);

    let stdoutBuffer = "";
    let stderrBuffer = "";

    child.stdout?.setEncoding("utf8").on("data", (chunk: string) => {
      stdoutBuffer += chunk;
      output.stdout += chunk;
      // Process any complete CAP_MARKER lines
      processCapRequests();
    });

    child.stderr?.setEncoding("utf8").on("data", (chunk: string) => {
      stderrBuffer += chunk;
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

    // Parse stdout buffer for CAP_MARKER lines and handle them
    function processCapRequests() {
      while (true) {
        const idx = stdoutBuffer.indexOf(CAP_MARKER);
        if (idx === -1) break;

        // Extract everything before the marker as user stdout
        const beforeMarker = stdoutBuffer.slice(0, idx);
        // The marker is at a line boundary, so beforeMarker should end with \n or be start
        // We'll keep the user stdout separate
        const afterMarker = stdoutBuffer.slice(idx + CAP_MARKER.length);

        // Find end of this JSON line (until newline)
        const lineEnd = afterMarker.indexOf("\n");
        if (lineEnd === -1) break; // incomplete line, wait for more data

        const jsonLine = afterMarker.slice(0, lineEnd);
        stdoutBuffer = beforeMarker + afterMarker.slice(lineEnd + 1);

        // Parse capability request
        try {
          const req = JSON.parse(jsonLine);
          const { id, capability, action, args } = req;

          // Find handler
          const capMap = capHandlers.get(capability);
          if (!capMap) {
            writeReply(child, { id, ok: false, error: `Unknown capability: ${capability}` });
            continue;
          }
          const handler = capMap.get(action);
          if (!handler) {
            writeReply(child, { id, ok: false, error: `Unknown action: ${capability}.${action}` });
            continue;
          }

          // Invoke handler asynchronously
          Promise.resolve(handler(args))
            .then((value) => writeReply(child, { id, ok: true, value }))
            .catch((err) => writeReply(child, { id, ok: false, error: formatError(err) }));
        } catch (e) {
          writeReply(child, { id: 0, ok: false, error: `Invalid capability request: ${formatError(e)}` });
        }
      }
    }

    function writeReply(childProc: typeof child, reply: { id: number; ok: boolean; value?: unknown; error?: string }) {
      if (!childProc.stdin?.writable) return;
      try {
        childProc.stdin.write(JSON.stringify(reply) + "\n");
      } catch {
        // stdin closed, child probably exited
      }
    }
  });
}

/**
 * 用 Python 子进程执行模型生成的 Code Action 的参考实现。
 *
 * 支持两种模式：
 * - 纯内存计算（无 capability）：直接执行，返回结果
 * - 带 Capability：通过 stdio bridge 让子进程里的代码调用宿主注入的能力（fs、shell 等）
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
  private readonly capabilities: Capability[];

  constructor(options: PythonRuntimeOptions = {}) {
    this.command = options.command;
    this.timeoutMs = options.timeoutMs ?? 1_000;
    this.capabilities = options.capabilities ?? [];
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

    const script = buildScript(code, this.capabilities);
    const commands = this.command ? [this.command] : ["python3", "python"];

    // Build capability handler map for fast lookup
    const capHandlers = new Map<string, Map<string, (args: unknown) => Promise<unknown>>>();
    for (const cap of this.capabilities) {
      const actionMap = new Map<string, (args: unknown) => Promise<unknown>>();
      for (const [actionName, handler] of Object.entries(cap.actions)) {
        actionMap.set(actionName, handler);
      }
      capHandlers.set(cap.name, actionMap);
    }

    for (const command of commands) {
      const outcome = await runProcess(command, script, this.timeoutMs, this.capabilities, capHandlers, output);

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