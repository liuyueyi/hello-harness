import type { Model } from "@hello-harness/core";
import type { AgentRuntimeOptions } from "@hello-harness/core";
import type { ToolRegistry } from "@hello-harness/core";
import type { HookManager } from "@hello-harness/core";
import type { PermissionGate } from "@hello-harness/core";
import { AgentRuntime } from "@hello-harness/core";
import { systemMessage } from "@hello-harness/core";
import type { Workspace } from "@hello-harness/coding";
import { Session } from "@hello-harness/core";
import { SessionStore } from "./session/store";

const ANSI = {
  reset: "\x1b[0m",
  dim: "\x1b[2m",
  bold: "\x1b[1m",
  cyan: "\x1b[36m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  magenta: "\x1b[35m",
};

interface PiDeps {
  model: Model;
  workspace: Workspace;
  registry: ToolRegistry;
  hooks: HookManager;
  gate?: PermissionGate;
  systemPrompt: string;
  options: AgentRuntimeOptions;
  confirmTools?: boolean;
}

interface ToolView {
  name: string;
  args: string;
  status: "running" | "ok" | "error";
  startedAt?: number;
  durationMs?: number;
  summary?: string;
  fullOutput?: string;
}

type Segment =
  | { kind: "reasoning"; text: string }
  | { kind: "content"; text: string }
  | { kind: "tool"; tool: ToolView };

interface TurnView {
  user?: string;
  userAt?: Date;
  segments: Segment[];
  tokensIn: number;
  tokensOut: number;
  durationMs?: number;
  done: boolean;
}

function charWidth(code: number): number {
  if (code < 0x20 || code === 0x7f) return 0;
  if ((code >= 0x300 && code <= 0x36f) || (code >= 0x200b && code <= 0x200f) || (code >= 0xfe00 && code <= 0xfe0f)) return 0;
  if (code >= 0x1f000) return 2;
  if (
    (code >= 0x1100 && code <= 0x115f) ||
    (code >= 0x2e80 && code <= 0x303e) ||
    (code >= 0x3041 && code <= 0x33ff) ||
    (code >= 0x3400 && code <= 0x4dbf) ||
    (code >= 0x4e00 && code <= 0x9fff) ||
    (code >= 0xa000 && code <= 0xa4cf) ||
    (code >= 0xac00 && code <= 0xd7a3) ||
    (code >= 0xf900 && code <= 0xfaff) ||
    (code >= 0xfe30 && code <= 0xfe4f) ||
    (code >= 0xff00 && code <= 0xff60) ||
    (code >= 0xffe0 && code <= 0xffe6)
  ) {
    return 2;
  }
  return 1;
}

function tokenize(text: string): Array<{ text: string; width: number; brk?: boolean }> {
  const tokens: Array<{ text: string; width: number; brk?: boolean }> = [];
  let i = 0;
  while (i < text.length) {
    const c = text[i];
    if (c === "\n") {
      tokens.push({ text: "\n", width: 0, brk: true });
      i += 1;
      continue;
    }
    if (c === "\x1b") {
      let j = i + 1;
      let seq = c;
      while (j < text.length && !/[A-Za-z~]/.test(text[j])) {
        seq += text[j];
        j += 1;
      }
      if (j < text.length) seq += text[j];
      tokens.push({ text: seq, width: 0 });
      i = j + 1;
      continue;
    }
    const code = text.codePointAt(i) ?? 0;
    const ch = String.fromCodePoint(code);
    tokens.push({ text: ch, width: charWidth(code) });
    i += ch.length;
  }
  return tokens;
}

function wrapAnsi(text: string, width: number): string[] {
  const tokens = tokenize(text);
  const lines: string[] = [];
  let line = "";
  let lineWidth = 0;
  for (const tok of tokens) {
    if (tok.brk) {
      lines.push(line);
      line = "";
      lineWidth = 0;
      continue;
    }
    if (tok.width === 0) {
      line += tok.text;
      continue;
    }
    if (lineWidth + tok.width > width && lineWidth > 0) {
      lines.push(line);
      line = tok.text;
      lineWidth = tok.width;
    } else {
      line += tok.text;
      lineWidth += tok.width;
    }
  }
  lines.push(line);
  return lines.length ? lines : [""];
}

export class PiTui {
  private readonly model: Model;
  private readonly workspace: Workspace;
  private readonly registry: ToolRegistry;
  private readonly hooks: HookManager;
  private readonly gate?: PermissionGate;
  private readonly systemPrompt: string;
  private readonly options: AgentRuntimeOptions;
  private readonly confirmTools: boolean;

  private readonly colorOn: boolean;
  private readonly session: Session;
  private readonly store: SessionStore;

  private history: TurnView[] = [];
  private current: TurnView | null = null;
  private running = false;
  private turnStart = 0;
  private turnTokensIn = 0;
  private turnTokensOut = 0;
  private toolIndex = 0;
  private toolSegs: ToolView[] = [];
  private readonly sessionTokens = { in: 0, out: 0 };

  private inputBuf = "";
  private cursor = 0;
  private inputResolve: ((value: string | null) => void) | null = null;
  private readonly cmdHistory: string[] = [];
  private histIdx = 0;
  private expandTools = false;

  private confirmState: { text: string; resolve: (value: boolean) => void } | null = null;

  private tty = false;
  private timer: ReturnType<typeof setInterval> | undefined;
  private activeRuntime: AgentRuntime | undefined;

  private scrollOffset = 0;
  private maxScroll = 0;
  private totalLines = 0;

  private readonly onKeyBound = (data: Buffer) => this.onKey(data);
  private readonly redrawBound = () => this.redraw();

  constructor(deps: PiDeps) {
    this.model = deps.model;
    this.workspace = deps.workspace;
    this.registry = deps.registry;
    this.hooks = deps.hooks;
    this.gate = deps.gate;
    this.systemPrompt = deps.systemPrompt;
    this.options = deps.options;
    this.confirmTools = deps.confirmTools ?? false;
    this.colorOn = process.stdout.isTTY === true && !process.env.NO_COLOR;
    this.session = new Session(undefined, [systemMessage(this.systemPrompt)]);
    this.store = new SessionStore(this.workspace);
  }

  async start(): Promise<void> {
    if (process.stdout.isTTY !== true) {
      const { chat } = await import("./chat");
      await chat(this.model, this.registry, this.systemPrompt, this.workspace, this.options);
      return;
    }
    this.tty = true;
    if (this.gate && this.confirmTools) {
      this.gate.setAsk(async (_call, reason) => this.confirm(reason));
    }
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.on("data", this.onKeyBound);
    process.on("SIGWINCH", this.redrawBound);
    process.stdout.write("\x1b[?1049h");
    this.redraw();
    try {
      for (;;) {
        const input = await this.waitForInput();
        if (input === null) break;
        const text = input.trim();
        if (text === "/exit" || text === "/quit") break;
        if (text === "/clear") {
          this.history = [];
          this.scrollOffset = 0;
          this.redraw();
          continue;
        }
        if (text === "/help") {
          this.history.push({
            segments: [
              {
                kind: "content",
                text:
                  "命令：/exit 退出 · /clear 清屏 · /help 帮助。\n" +
                  "快捷键：←→ 移动光标编辑输入 · Ctrl+A/E 跳到行首/行尾 · Tab 展开/收起工具输入输出 · Ctrl+C 取消本轮生成 · Ctrl+L 重绘 · ↑/↓ 或 PageUp/PageDown 翻看历史 · Home/End 跳到顶/底。",
              },
            ],
            tokensIn: 0,
            tokensOut: 0,
            done: true,
          });
          this.scrollOffset = 0;
          this.redraw();
          continue;
        }
        if (text === "") continue;
        this.cmdHistory.push(text);
        this.histIdx = this.cmdHistory.length;
        await this.runTurn(text);
      }
    } finally {
      if (this.timer) clearInterval(this.timer);
      process.stdin.removeListener("data", this.onKeyBound);
      process.removeListener("SIGWINCH", this.redrawBound);
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdout.write("\x1b[?25h\x1b[?1049l");
      process.stdout.write("\n");
    }
  }

  private waitForInput(): Promise<string | null> {
    return new Promise((resolve) => {
      this.inputResolve = resolve;
      this.redraw();
    });
  }

  private onKey(data: Buffer): void {
    const s = data.toString();

    if (this.confirmState) {
      if (s === "\r" || s === "\n") {
        const ans = this.inputBuf;
        const resolve = this.confirmState.resolve;
        this.confirmState = null;
        this.inputBuf = "";
        resolve(/^(y|yes|allow|允许|1)$/i.test(ans.trim()));
        this.redraw();
      } else if (s === "\x03") {
        const resolve = this.confirmState.resolve;
        this.confirmState = null;
        this.inputBuf = "";
        resolve(false);
        this.redraw();
      } else if (s === "\x7f") {
        this.inputBuf = this.inputBuf.slice(0, -1);
        this.redraw();
      } else if (s >= " " && s !== "\x7f") {
        this.inputBuf += s;
        this.redraw();
      }
      return;
    }

    if (this.running) {
      if (s === "\x03") this.activeRuntime?.abort();
      else if (s === "\t") {
        this.expandTools = !this.expandTools;
        this.redraw();
      } else if (s === "\x1b[5~") this.scrollBy(this.pageSize());
      else if (s === "\x1b[6~") this.scrollBy(-this.pageSize());
      else if (s === "\x1b[H" || s === "\x1b[1~") this.scrollToTop();
      else if (s === "\x1b[F" || s === "\x1b[4~") this.scrollToBottom();
      else if (s === "\x1b[A") this.scrollBy(1);
      else if (s === "\x1b[B") this.scrollBy(-1);
      return;
    }

    if (s === "\x03") {
      if (this.inputResolve) {
        const r = this.inputResolve;
        this.inputResolve = null;
        r(null);
      }
      return;
    }
    if (s === "\x0c") {
      this.redraw();
      return;
    }
    if (s === "\t") {
      this.expandTools = !this.expandTools;
      this.redraw();
      return;
    }
    if (s === "\r" || s === "\n") {
      const text = this.inputBuf;
      this.inputBuf = "";
      this.cursor = 0;
      if (this.inputResolve) {
        const r = this.inputResolve;
        this.inputResolve = null;
        r(text);
      }
      return;
    }
    if (s === "\x1b[D") {
      this.cursor = Math.max(0, this.cursor - 1);
      this.redraw();
      return;
    }
    if (s === "\x1b[C") {
      this.cursor = Math.min(this.inputBuf.length, this.cursor + 1);
      this.redraw();
      return;
    }
    if (s === "\x01") {
      this.cursor = 0;
      this.redraw();
      return;
    }
    if (s === "\x05") {
      this.cursor = this.inputBuf.length;
      this.redraw();
      return;
    }
    if (s === "\x1b[3~") {
      if (this.cursor < this.inputBuf.length) {
        this.inputBuf = this.inputBuf.slice(0, this.cursor) + this.inputBuf.slice(this.cursor + 1);
        this.redraw();
      }
      return;
    }
    if (s === "\x7f") {
      if (this.cursor > 0) {
        this.inputBuf = this.inputBuf.slice(0, this.cursor - 1) + this.inputBuf.slice(this.cursor);
        this.cursor -= 1;
      }
      this.redraw();
      return;
    }
    if (s === "\x1b[5~") {
      this.scrollBy(this.pageSize());
      return;
    }
    if (s === "\x1b[6~") {
      this.scrollBy(-this.pageSize());
      return;
    }
    if (s === "\x1b[H" || s === "\x1b[1~") {
      this.scrollToTop();
      return;
    }
    if (s === "\x1b[F" || s === "\x1b[4~") {
      this.scrollToBottom();
      return;
    }
    if (s === "\x1b[A") {
      if (this.scrollOffset < this.maxScroll) {
        this.scrollBy(1);
      } else if (this.cmdHistory.length > 0 && this.histIdx > 0) {
        this.histIdx -= 1;
        this.inputBuf = this.cmdHistory[this.histIdx];
        this.cursor = this.inputBuf.length;
        this.redraw();
      }
      return;
    }
    if (s === "\x1b[B") {
      if (this.scrollOffset > 0) {
        this.scrollBy(-1);
      } else if (this.histIdx < this.cmdHistory.length - 1) {
        this.histIdx += 1;
        this.inputBuf = this.cmdHistory[this.histIdx];
        this.cursor = this.inputBuf.length;
      } else {
        this.histIdx = this.cmdHistory.length;
        this.inputBuf = "";
        this.cursor = 0;
      }
      this.redraw();
      return;
    }
    if (s >= " " && s !== "\x7f") {
      this.inputBuf = this.inputBuf.slice(0, this.cursor) + s + this.inputBuf.slice(this.cursor);
      this.cursor += s.length;
      this.redraw();
    }
  }

  private pageSize(): number {
    const rows = process.stdout.rows ?? 24;
    return Math.max(1, rows - 4);
  }

  private scrollBy(delta: number): void {
    this.scrollOffset = Math.max(0, Math.min(this.maxScroll, this.scrollOffset + delta));
    this.redraw();
  }

  private scrollToTop(): void {
    this.scrollOffset = this.maxScroll;
    this.redraw();
  }

  private scrollToBottom(): void {
    this.scrollOffset = 0;
    this.redraw();
  }

  private confirm(question: string): Promise<boolean> {
    return new Promise((resolve) => {
      this.confirmState = { text: question, resolve };
      this.inputBuf = "";
      this.redraw();
    });
  }

  private async runTurn(prompt: string): Promise<void> {
    this.running = true;
    this.current = {
      user: prompt,
      userAt: new Date(),
      segments: [],
      tokensIn: 0,
      tokensOut: 0,
      done: false,
    };
    this.inputBuf = "";
    this.turnStart = Date.now();
    this.turnTokensIn = 0;
    this.turnTokensOut = 0;
    this.toolIndex = 0;
    this.toolSegs = [];
    this.scrollToBottom();
    this.redraw();

    const runtime = new AgentRuntime(this.model, this.registry, {
      ...this.options,
      streaming: true,
      hooks: this.hooks,
    });
    this.activeRuntime = runtime;
    this.attach(runtime);

    if (this.tty) {
      this.timer = setInterval(() => this.redraw(), 150);
    }

    try {
      const run = await this.session.turn(runtime, prompt);
      if (this.current) {
        this.current.durationMs = Date.now() - this.turnStart;
        this.current.tokensIn = this.turnTokensIn;
        this.current.tokensOut = this.turnTokensOut;
        this.current.done = true;
        this.sessionTokens.in += this.turnTokensIn;
        this.sessionTokens.out += this.turnTokensOut;
        void run;
      }
    } catch (error) {
      if (this.current) {
        this.appendSegment("content", `\n[error] ${error instanceof Error ? error.message : String(error)}`);
        this.current.done = true;
      }
    } finally {
      if (this.timer) clearInterval(this.timer);
      if (this.current) this.history.push(this.current);
      this.current = null;
      this.running = false;
      this.scrollToBottom();
      if (this.tty) await this.store.save(this.session.snapshot());
      this.redraw();
    }
  }

  private appendSegment(kind: "reasoning" | "content", text: string): void {
    if (!this.current) return;
    const segs = this.current.segments;
    const last = segs[segs.length - 1];
    if (last && last.kind === kind) {
      last.text += text;
    } else {
      segs.push({ kind, text });
    }
  }

  // 用模型最终返回的（已清洗的）正文覆盖本轮累积的 content 片段，
  // 这样若流式过程中把工具调用 JSON 当作正文渲染，也会在结束时被清掉。
  private setContent(text: string): void {
    if (!this.current) return;
    const segs = this.current.segments;
    for (let i = segs.length - 1; i >= 0; i--) {
      if (segs[i].kind === "content") segs.splice(i, 1);
    }
    if (text.trim() !== "") segs.push({ kind: "content", text });
  }

  private attach(runtime: AgentRuntime): void {
    runtime.on("model:start", () => {
      this.redraw();
    });
    runtime.on("model:reasoning", (e) => {
      this.appendSegment("reasoning", e.text);
      this.redraw();
    });
    runtime.on("model:delta", (e) => {
      this.appendSegment("content", e.text);
      this.redraw();
    });
    runtime.on("model:end", (e) => {
      if (!this.current) return;
      this.turnTokensIn += e.response.inputTokens;
      this.turnTokensOut += e.response.outputTokens;
      this.setContent(e.response.content);
      for (const call of e.response.toolCalls) {
        const tv: ToolView = { name: call.name, args: JSON.stringify(call.arguments), status: "running" };
        this.current.segments.push({ kind: "tool", tool: tv });
        this.toolSegs.push(tv);
      }
      this.redraw();
    });
    runtime.on("tool:start", () => {
      const tool = this.toolSegs[this.toolIndex];
      if (tool) tool.startedAt = Date.now();
      this.redraw();
    });
    runtime.on("tool:end", (e) => {
      const tool = this.toolSegs[this.toolIndex];
      if (tool) {
        tool.status = e.result.ok ? "ok" : "error";
        tool.durationMs = tool.startedAt !== undefined ? Date.now() - tool.startedAt : e.durationMs;
        const detail = e.result.ok ? this.formatValue(e.result.value) : `[${e.result.kind}] ${e.result.error}`;
        tool.summary = this.summarize(detail);
        tool.fullOutput = detail;
      }
      this.toolIndex += 1;
      this.redraw();
    });
  }

  private summarize(value: unknown): string {
    if (typeof value === "string") {
      const first = value.split("\n").find((line) => line.trim() !== "") ?? "";
      return first.slice(0, 80);
    }
    const record = value as Record<string, unknown>;
    if (record && typeof record === "object") {
      const stdout = typeof record.stdout === "string" ? record.stdout : undefined;
      if (stdout) {
        const first = stdout.split("\n").find((line) => line.trim() !== "") ?? "";
        return `stdout="${first.slice(0, 80)}"`;
      }
      if ("ok" in record) return JSON.stringify(value).slice(0, 100);
    }
    return JSON.stringify(value).slice(0, 100);
  }

  private formatValue(value: unknown): string {
    if (typeof value === "string") return value;
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  }

  private spinner(): string {
    const frames = "⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏";
    return frames[Math.floor(Date.now() / 100) % frames.length];
  }

  private formatStamp(d: Date): string {
    const p = (n: number) => String(n).padStart(2, "0");
    return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
  }

  private nowStamp(): string {
    return this.formatStamp(new Date());
  }

  private color(text: string, code: string): string {
    return this.colorOn ? `${code}${text}${ANSI.reset}` : text;
  }

  private coloredWrapped(text: string, code: string, width: number): string[] {
    return wrapAnsi(text, width).map((line) => `${code}${line}${ANSI.reset}`);
  }

  private renderTurn(turn: TurnView, width: number): string[] {
    const out: string[] = [];
    if (turn.user !== undefined) {
      const stamp = turn.userAt ? this.formatStamp(turn.userAt) : this.nowStamp();
      out.push(...this.coloredWrapped(`[${stamp}] You: ${turn.user}`, ANSI.cyan + ANSI.bold, width));
    }
    const active = this.running && !turn.done;
    for (let i = 0; i < turn.segments.length; i++) {
      const seg = turn.segments[i];
      if (i > 0) out.push("");
      const isActive = active && i === turn.segments.length - 1;
      const spin = isActive ? ` ${this.spinner()}` : "";
      if (seg.kind === "reasoning") {
        out.push(this.color(`── 思考 ──${spin}`, ANSI.dim));
        out.push(...this.coloredWrapped(seg.text.trim(), ANSI.dim, width));
      } else if (seg.kind === "content") {
        out.push(this.color(`── 回复 ──${spin}`, ANSI.dim));
        out.push(...this.coloredWrapped(seg.text.trim(), ANSI.reset, width));
      } else {
        const tool = seg.tool;
        const icon = tool.status === "running" ? `⏳${this.spinner()}` : tool.status === "ok" ? "✓" : "✗";
        const code = tool.status === "ok" ? ANSI.green : tool.status === "error" ? ANSI.red : ANSI.yellow;
        if (!this.expandTools) {
          const tail = tool.status === "running" ? "" : ` → ${tool.summary ?? ""} (${tool.durationMs ?? 0}ms)`;
          const line = `${icon} ${tool.name}(${tool.args})${tail}`;
          out.push(...this.coloredWrapped(line, code, width));
        } else {
          const head = `${icon} ${tool.name}  (${tool.durationMs ?? 0}ms)`;
          out.push(this.color(head, code));
          out.push(this.color("  输入: " + (tool.args || "{}"), ANSI.dim));
          const detail = tool.status === "running" ? "（执行中…）" : tool.fullOutput ?? tool.summary ?? "";
          for (const l of detail.split("\n")) {
            out.push(...this.coloredWrapped("  输出: " + l, ANSI.dim, width));
          }
        }
      }
    }
    if (active) {
      const last = turn.segments[turn.segments.length - 1];
      if (!last) {
        out.push(this.color(`● 生成中 ${this.spinner()}`, ANSI.dim));
      } else if (last.kind === "tool" && last.tool.status !== "running") {
        out.push(this.color(`● 生成回答中 ${this.spinner()}`, ANSI.dim));
      }
    }
    if (turn.done) {
      out.push(
        ...this.coloredWrapped(
          `⏱ ${turn.durationMs ?? 0}ms · 🪙 ${turn.tokensIn} in / ${turn.tokensOut} out`,
          ANSI.dim,
          width,
        ),
      );
    }
    return out;
  }

  private buildLines(width: number): string[] {
    const lines: string[] = [];
    lines.push(this.color("hello · Pi TUI  (输入 /exit 退出 · ←→ 编辑 · Tab 展开工具 · ↑↓/PgUp/PgDn 翻页 · Ctrl+C 取消本轮)", ANSI.magenta));
    for (let i = 0; i < this.history.length; i++) {
      if (i > 0) lines.push("");
      lines.push(...this.renderTurn(this.history[i], width));
    }
    if (this.current) {
      if (this.history.length > 0) lines.push("");
      lines.push(...this.renderTurn(this.current, width));
    }
    return lines;
  }

  private statusLine(width: number): string {
    if (this.confirmState) {
      const text = `⚠ ${this.confirmState.text}  (y/N)`;
      return this.color(text.length > width ? text.slice(0, width) : text, ANSI.yellow);
    }
    const elapsed = this.running ? ((Date.now() - this.turnStart) / 1000).toFixed(1) : "0.0";
    const scrollHint =
      this.scrollOffset > 0
        ? `↑ 已上翻 ${this.scrollOffset} 行 · End 回底部`
        : this.maxScroll > 0
          ? `↑↓/PgUp/PgDn 翻页 · 共 ${this.totalLines} 行`
          : "";
    const parts = [
      this.running ? "● 生成中" : "○ 空闲，可输入",
      `⏱ 本轮 ${elapsed}s`,
      `🪙 本轮 ${this.turnTokensIn}/${this.turnTokensOut}`,
      `会话 ${this.sessionTokens.in}/${this.sessionTokens.out}`,
      scrollHint || "· /exit 退出",
    ];
    const text = parts.join("  ");
    return this.color(text.length > width ? text.slice(0, width) : text, ANSI.dim);
  }

  private bottomLine(width: number): string {
    if (this.confirmState) {
      const t = `❯ ${this.inputBuf}▌`;
      return this.color(t.length > width ? t.slice(0, width) : t, ANSI.cyan);
    }
    if (this.running) {
      const elapsed = ((Date.now() - this.turnStart) / 1000).toFixed(1);
      let t = `${this.spinner()} 生成中…  ⏱ ${elapsed}s  (Ctrl+C 取消)`;
      if (t.length > width) t = t.slice(0, width);
      return this.color(t, ANSI.yellow);
    }
    const before = this.inputBuf.slice(0, this.cursor);
    const at = this.inputBuf[this.cursor] ?? " ";
    const after = this.inputBuf.slice(this.cursor + 1);
    const inner = `${before}\x1b[7m${at}\x1b[0m${after}`;
    const t = `▶ ${inner}`;
    return this.color(t.length > width ? t.slice(0, width) : t, ANSI.cyan);
  }

  private redraw(): void {
    if (!this.tty) return;
    const cols = process.stdout.columns ?? 80;
    const rows = process.stdout.rows ?? 24;
    const width = Math.max(20, cols - 2);
    const bottomPlain = this.bottomLine(width).replace(/\x1b\[[0-9;]*m/g, "");
    const bottomLines = Math.max(1, wrapAnsi(bottomPlain, width).length);
    const headerLines = 1;
    const statusLines = 1;
    const avail = Math.max(1, rows - headerLines - statusLines - bottomLines);
    const all = this.buildLines(width);
    this.totalLines = all.length;
    this.maxScroll = Math.max(0, all.length - avail);
    if (this.scrollOffset > this.maxScroll) this.scrollOffset = this.maxScroll;
    const start = Math.max(0, all.length - avail - this.scrollOffset);
    const view = all.slice(start, start + avail);
    let out = "\x1b[?25l\x1b[H\x1b[J";
    out += view.join("\n");
    out += "\n";
    out += this.statusLine(width) + "\n";
    out += this.bottomLine(width);
    process.stdout.write(out);
  }

  renderToText(width = 80): string {
    return this.buildLines(width).join("\n");
  }

  async runScripted(inputs: string[]): Promise<void> {
    for (const text of inputs) {
      await this.runTurn(text);
      console.log(this.renderToText(80));
      console.log("─".repeat(80));
      await new Promise((r) => setTimeout(r, 1200));
    }
  }
}
