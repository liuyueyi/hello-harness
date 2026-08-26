import { spawn, type ChildProcess } from "node:child_process";
import type { CodeRuntime, RuntimeResult } from "./runtime";
import type { Capability } from "./capability";

export interface PythonRuntimeOptions {
  /** 子进程入口命令；默认优先 `python3`，失败再回退 `python`。 */
  command?: string;
  /** 单段 Code Action 最长执行时间，超时直接杀掉内核并重启。 */
  timeoutMs?: number;
  /** 注入给代码执行环境的 Capability 集合。 */
  capabilities?: Capability[];
}

const RESULT_MARKER = "__HARNESS_RESULT__";
const CAP_MARKER = "__HARNESS_CAP__";
const CELL_END = "__HARNESS_CELL_END__";

interface PendingCell {
  startedAt: number;
  resolve: (result: RuntimeResult) => void;
  timer: ReturnType<typeof setTimeout>;
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * 生成一个「常驻内核」脚本：启动后进入无限循环，每次从 stdin 读取一个单元格
 * （以 `CELL_END` 哨兵行结尾），在**全局作用域**里 `exec`，因此单元格之间
 * 的变量、导入、函数都会保留——这就是 Persistent Runtime 的精髓：
 * 一个解释器进程常驻，不再「执行一次，退出一次」。
 *
 * 单元格的返回值通过 AST 变换捕获：若最后一条语句是表达式，则改写为
 * `__hr_last__ = <expr>`，执行后从 globals 取出；顶层 `return X` 也改写为
 * `__hr_last__ = X`，从而兼容第 45 章能力演示里的 `return {...}` 写法。
 */
function buildKernelScript(capabilities: Capability[]): string {
  const manifest = capabilities.map((cap) => [cap.name, Object.keys(cap.actions)]);
  const manifestJson = JSON.stringify(manifest);

  return [
    "import json, sys, ast, types, textwrap",
    "",
    "__hr_cap_id = 0",
    "",
    "def __hr_cap_call(capability, action, args):",
    "    global __hr_cap_id",
    "    __hr_cap_id += 1",
    "    req = json.dumps({'id': __hr_cap_id, 'capability': capability, 'action': action, 'args': args})",
    "    sys.stdout.write('\\n" + CAP_MARKER + "' + req + '\\n')",
    "    sys.stdout.flush()",
    "    line = sys.stdin.readline()",
    "    if not line:",
    "        raise RuntimeError('Capability bridge: EOF from host')",
    "    reply = json.loads(line.strip())",
    "    if not reply.get('ok', False):",
    "        raise RuntimeError(f\"[{capability}.{action}] {reply.get('error', 'Unknown error')}\")",
    "    return reply.get('value')",
    "",
    "# 在内核启动时一次性注入 Capability 命名空间。",
    "for cap_name, actions in " + manifestJson + ":",
    "    ns = types.SimpleNamespace()",
    "    for act in actions:",
    "        setattr(ns, act, lambda *a, _c=cap_name, _a=act, **kw: __hr_cap_call(_c, _a, a[0] if a else (kw or {})))",
    "    globals()[cap_name] = ns",
    "",
    "class __hr_ReturnTransformer(ast.NodeTransformer):",
    "    # 把「模块层级」的 return 改写为 __hr_last__ = ...（支持 try/if/for 内顶层的 return），",
    "    # 函数/异步函数内的 return 保持不变，从而兼容第 45 章能力演示里的 return 写法。",
    "    def __init__(self):",
    "        self.depth = 0",
    "    def visit_FunctionDef(self, node):",
    "        self.depth += 1",
    "        self.generic_visit(node)",
    "        self.depth -= 1",
    "        return node",
    "    visit_AsyncFunctionDef = visit_FunctionDef",
    "    def visit_Return(self, node):",
    "        if self.depth == 0:",
    "            return ast.Assign(targets=[ast.Name(id='__hr_last__', ctx=ast.Store())], value=node.value)",
    "        return node",
    "",
    "def __hr_compile_cell(code):",
    "    tree = ast.parse(code)",
    "    tree = __hr_ReturnTransformer().visit(tree)",
    "    ast.fix_missing_locations(tree)",
    "    try:",
    "        compile(tree, '<cell>', 'exec')",
    "    except SyntaxError:",
    "        tree = ast.parse(code)",
    "        if tree.body and isinstance(tree.body[-1], ast.Expr):",
    "            tree.body[-1] = ast.Assign(",
    "                targets=[ast.Name(id='__hr_last__', ctx=ast.Store())],",
    "                value=tree.body[-1].value,",
    "            )",
    "            ast.fix_missing_locations(tree)",
    "        compile(tree, '<cell>', 'exec')",
    "    if tree.body and isinstance(tree.body[-1], ast.Expr):",
    "        last = tree.body[-1]",
    "        tree.body[-1] = ast.Assign(",
    "            targets=[ast.Name(id='__hr_last__', ctx=ast.Store())],",
    "            value=last.value,",
    "        )",
    "        ast.fix_missing_locations(tree)",
    "    return compile(tree, '<cell>', 'exec')",
    "",
    "while True:",
    "    lines = []",
    "    while True:",
    "        line = sys.stdin.readline()",
    "        if line == '':",
    "            sys.exit(0)",
    "        if line.rstrip('\\n') == '" + CELL_END + "':",
    "            break",
    "        lines.append(line)",
    "    code = ''.join(lines)",
    "    # 演示里常用缩进的 heredoc 风格模板字符串，先按公共缩去除缩进，避免误判 IndentationError。",
    "    code = textwrap.dedent(code)",
    "    try:",
    "        exec(__hr_compile_cell(code), globals())",
    "        value = globals().pop('__hr_last__', None)",
    "        sys.stdout.write('\\n" + RESULT_MARKER + "' + json.dumps({'ok': True, 'value': value}) + '\\n')",
    "    except BaseException:",
    "        import traceback",
    "        traceback.print_exc()",
    "        sys.stdout.write('\\n" + RESULT_MARKER + "' + json.dumps({'ok': False}) + '\\n')",
    "    sys.stdout.flush()",
  ].join("\n");
}

function extractError(stderr: string): string {
  const lines = stderr.split("\n").map((line) => line.trim()).filter(Boolean);
  const last = lines[lines.length - 1];
  return last ? last : "Python 内核执行失败";
}

/**
 * 常驻内核版 Python 运行时。
 *
 * 与第 45 章「一次执行、一次退出」不同，本章只启动**一个** Python 子进程，
 * 它通过 stdin/stdout 与宿主持续通信：
 *
 * - 宿主向 stdin 写入一段单元格代码 + 哨兵行 `__HARNESS_CELL_END__`
 * - 内核在**全局作用域** `exec` 这段代码，变量/导入/函数在多次单元格间保留
 * - 执行期间若代码调用 Capability（如 `fs.read`），内核用 `__HARNESS_CAP__` 行
 *   向宿主请求，宿主通过 stdin 回写结果（与第 45 章相同的 bridge 协议）
 * - 单元格结束后，内核用 `__HARNESS_RESULT__` 行回写 `{"ok", "value"}`
 *
 * `reset()` 会杀掉内核进程；下一次 `execute` 重新拉起一个干净的内核。
 */
export class PythonRuntime implements CodeRuntime {
  private readonly command?: string;
  private readonly timeoutMs: number;
  private readonly capabilities: Capability[];
  private readonly capHandlers: Map<string, Map<string, (args: unknown) => Promise<unknown>>>;
  private readonly kernelScript: string;

  /** 常驻内核进程；为 null 表示尚未启动或已被 reset 杀掉。 */
  private proc: ChildProcess | null = null;
  /** 当前单元格累积的 stdout / stderr。 */
  private stdoutBuffer = "";
  private stderrBuffer = "";
  /** 当前正在执行的单元格（串行，同一时刻最多一个）。 */
  private pending: PendingCell | null = null;

  constructor(options: PythonRuntimeOptions = {}) {
    this.command = options.command;
    this.timeoutMs = options.timeoutMs ?? 1_000;
    this.capabilities = options.capabilities ?? [];
    this.kernelScript = buildKernelScript(this.capabilities);

    const capHandlers = new Map<string, Map<string, (args: unknown) => Promise<unknown>>>();
    for (const cap of this.capabilities) {
      const actionMap = new Map<string, (args: unknown) => Promise<unknown>>();
      for (const [actionName, handler] of Object.entries(cap.actions)) {
        actionMap.set(actionName, handler);
      }
      capHandlers.set(cap.name, actionMap);
    }
    this.capHandlers = capHandlers;
  }

  /** 确保常驻内核已启动；已存在则直接返回。 */
  private ensureKernel(): Promise<void> {
    if (this.proc && !this.proc.killed) return Promise.resolve();
    return this.startKernel();
  }

  private startKernel(): Promise<void> {
    const commands = this.command ? [this.command] : ["python3", "python"];
    return new Promise((resolve, reject) => {
      let settled = false;
      let index = 0;

      const tryNext = () => {
        if (settled) return;
        if (index >= commands.length) {
          settled = true;
          reject(new Error("找不到可用的 Python 解释器（已尝试 " + commands.join(" / ") + "）"));
          return;
        }
        const cmd = commands[index++];
        const proc = spawn(cmd, ["-X", "utf8", "-c", this.kernelScript], {
          stdio: ["pipe", "pipe", "pipe"],
          env: { ...process.env, PYTHONIOENCODING: "utf-8" },
        });

        proc.on("spawn", () => {
          if (settled) return;
          settled = true;
          this.proc = proc;
          resolve();
        });

        proc.on("error", () => {
          // 启动失败（如命令不存在）→ 尝试下一个候选命令。
          if (!settled) tryNext();
        });

        proc.on("close", (code) => {
          // 仅当退出的正是当前内核时才清理；被 reset 杀掉时 this.proc 已置空。
          if (this.proc === proc) this.proc = null;
          if (this.pending && this.proc === proc) {
            const p = this.pending;
            this.pending = null;
            clearTimeout(p.timer);
            p.resolve({
              ok: false,
              stdout: this.stdoutBuffer,
              stderr: this.stderrBuffer,
              error: `Python 内核意外退出（退出码 ${code ?? -1}）`,
              durationMs: Date.now() - p.startedAt,
            });
            this.stdoutBuffer = "";
            this.stderrBuffer = "";
          }
        });

        proc.stdout?.setEncoding("utf8").on("data", (chunk: string) => this.onStdout(chunk));
        proc.stderr?.setEncoding("utf8").on("data", (chunk: string) => {
          this.stderrBuffer += chunk;
        });
      };

      tryNext();
    });
  }

  private onStdout(chunk: string): void {
    this.stdoutBuffer += chunk;
    // Windows 上 Python 会把 \n 翻译成 \r\n，统一回车换行，避免标记行与用户输出里混入 \r。
    this.stdoutBuffer = this.stdoutBuffer.replace(/\r\n/g, "\n");

    // 1) 先处理所有完整的 Capability 请求行（从缓冲区中抽走，不计入用户输出）。
    while (true) {
      const capIdx = this.stdoutBuffer.indexOf(CAP_MARKER);
      if (capIdx === -1) break;
      const before = this.stdoutBuffer.slice(0, capIdx);
      const after = this.stdoutBuffer.slice(capIdx + CAP_MARKER.length);
      const lineEnd = after.indexOf("\n");
      if (lineEnd === -1) break; // 行尚未完整，等待更多数据
      const jsonLine = after.slice(0, lineEnd);
      this.stdoutBuffer = before + after.slice(lineEnd + 1);
      try {
        this.handleCapRequest(JSON.parse(jsonLine));
      } catch {
        // 忽略畸形请求
      }
    }

    // 2) 处理单元格结果哨兵。
    const resIdx = this.stdoutBuffer.indexOf(RESULT_MARKER);
    if (resIdx === -1) return;
    const stdoutPart = this.stdoutBuffer.slice(0, resIdx);
    const afterRes = this.stdoutBuffer.slice(resIdx + RESULT_MARKER.length);
    const nl = afterRes.indexOf("\n");
    const payload = nl === -1 ? afterRes : afterRes.slice(0, nl);
    this.stdoutBuffer = "";

    let ok = true;
    let value: unknown = undefined;
    try {
      const parsed = JSON.parse(payload);
      ok = parsed.ok !== false;
      value = parsed.value;
    } catch {
      ok = false;
    }

    if (!this.pending) return;
    const p = this.pending;
    this.pending = null;
    clearTimeout(p.timer);

    const durationMs = Date.now() - p.startedAt;
    if (ok) {
      p.resolve({
        ok: true,
        stdout: stdoutPart.replace(/\n$/, ""),
        stderr: this.stderrBuffer,
        value,
        durationMs,
      });
    } else {
      p.resolve({
        ok: false,
        stdout: stdoutPart.replace(/\n$/, ""),
        stderr: this.stderrBuffer,
        error: extractError(this.stderrBuffer),
        durationMs,
      });
    }
    this.stderrBuffer = "";
  }

  private handleCapRequest(req: { id: number; capability: string; action: string; args: unknown }): void {
    const capMap = this.capHandlers.get(req.capability);
    if (!capMap) {
      this.writeReply(req.id, false, undefined, `Unknown capability: ${req.capability}`);
      return;
    }
    const handler = capMap.get(req.action);
    if (!handler) {
      this.writeReply(req.id, false, undefined, `Unknown action: ${req.capability}.${req.action}`);
      return;
    }
    Promise.resolve(handler(req.args))
      .then((value) => this.writeReply(req.id, true, value))
      .catch((err) => this.writeReply(req.id, false, undefined, formatError(err)));
  }

  private writeReply(id: number, ok: boolean, value?: unknown, error?: string): void {
    if (!this.proc?.stdin?.writable) return;
    try {
      this.proc.stdin.write(JSON.stringify({ id, ok, value, error }) + "\n");
    } catch {
      // stdin 已关闭（内核可能已退出）
    }
  }

  private killKernel(): void {
    if (this.proc) {
      try {
        this.proc.kill("SIGKILL");
      } catch {
        // 忽略
      }
      this.proc = null;
    }
  }

  async execute(code: string): Promise<RuntimeResult> {
    const startedAt = Date.now();
    if (code.trim() === "") {
      return { ok: false, stdout: "", stderr: "", error: "代码不能为空", durationMs: 0 };
    }

    try {
      await this.ensureKernel();
    } catch (e) {
      return { ok: false, stdout: "", stderr: "", error: formatError(e), durationMs: Date.now() - startedAt };
    }
    if (!this.proc) {
      return { ok: false, stdout: "", stderr: "", error: "Python 内核启动失败", durationMs: Date.now() - startedAt };
    }

    return new Promise<RuntimeResult>((resolve) => {
      const timer = setTimeout(() => {
        // 超时：杀掉内核并重启，避免卡死；本次单元格判为失败。
        this.killKernel();
        if (this.pending) this.pending = null;
        this.stdoutBuffer = "";
        this.stderrBuffer = "";
        resolve({
          ok: false,
          stdout: "",
          stderr: "",
          error: `Python 执行超过 ${this.timeoutMs}ms，已重启内核`,
          durationMs: Date.now() - startedAt,
        });
      }, this.timeoutMs);

      this.pending = { startedAt, resolve, timer };
      this.stdoutBuffer = "";
      this.stderrBuffer = "";
      this.proc!.stdin!.write(code + "\n" + CELL_END + "\n");
    });
  }

  async reset(): Promise<void> {
    this.killKernel();
    this.stdoutBuffer = "";
    this.stderrBuffer = "";
    if (this.pending) {
      const p = this.pending;
      this.pending = null;
      clearTimeout(p.timer);
      p.resolve({
        ok: false,
        stdout: "",
        stderr: "",
        error: "内核已被 reset",
        durationMs: Date.now() - p.startedAt,
      });
    }
  }
}
