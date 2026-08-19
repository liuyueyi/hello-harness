import type { AgentRuntime } from "../core/runtime/runtime";

const ANSI = {
  reset: "\x1b[0m",
  dim: "\x1b[90m",
  cyan: "\x1b[36m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
};

export interface TuiOptions {
  color?: boolean;
  runLabel?: string;
  maxTimeline?: number;
  maxDiffLines?: number;
}

interface TimelineEntry {
  label: string;
  text: string;
  tone: "plain" | "ok" | "error";
}

const PANEL_WIDTH = 76;

export class Tui {
  private readonly color: boolean;
  private readonly runLabel: string;
  private readonly maxTimeline: number;
  private readonly maxDiffLines: number;

  private status = "idle";
  private runId = "";
  private input = "";
  private thinking = "";
  private timeline: TimelineEntry[] = [];
  private diff: string[] = [];
  private tokensIn = 0;
  private tokensOut = 0;
  private steps = 0;
  private sawDelta = false;
  private active = false;

  constructor(options: TuiOptions = {}) {
    this.color = options.color ?? (process.stdout.isTTY && !process.env.NO_COLOR);
    this.runLabel = options.runLabel ?? "";
    this.maxTimeline = options.maxTimeline ?? 8;
    this.maxDiffLines = options.maxDiffLines ?? 40;
  }

  attach(runtime: AgentRuntime): void {
    this.active = true;
    if (this.color) {
      process.stdout.write("\x1b[?1049h\x1b[?25l");
    }

    runtime.on("run:start", (e) => {
      this.status = "running";
      this.runId = e.runId;
      this.input = e.input;
      this.redraw();
    });

    runtime.on("model:start", () => {
      this.sawDelta = false;
      this.redraw();
    });

    runtime.on("model:delta", (e) => {
      this.sawDelta = true;
      this.thinking += e.text;
      this.redraw();
    });

    runtime.on("model:end", (e) => {
      this.tokensIn += e.response.inputTokens;
      this.tokensOut += e.response.outputTokens;
      if (!this.sawDelta && e.response.content !== "") {
        this.thinking += e.response.content;
      }
      if (e.response.toolCalls.length > 0) {
        this.push("model", `→ 调用工具：${e.response.toolCalls.map((c) => c.name).join(", ")}`, "plain");
      } else {
        this.push("model", "→ 完成回答", "plain");
      }
      this.redraw();
    });

    runtime.on("model:retry", (e) => {
      this.push("retry", `第 ${e.attempt} 次重试：${e.error}`, "error");
      this.redraw();
    });

    runtime.on("tool:start", (e) => {
      this.push("tool", `${e.call.name}(${JSON.stringify(e.call.arguments)})`, "plain");
      this.redraw();
    });

    runtime.on("tool:end", (e) => {
      if (e.result.ok) {
        const text = this.summarizeValue(e.result.value);
        this.push("result", text, "ok");
        this.collectDiff(e.result.value);
      } else {
        this.push("result", `[${e.result.kind}] ${e.result.error}`, "error");
      }
      this.redraw();
    });

    runtime.on("step", (e) => {
      if (e.step.type === "model" || e.step.type === "tool") {
        this.steps += 1;
      }
    });

    runtime.on("run:end", (e) => {
      this.status = `${e.status} (${e.stopReason})`;
      this.redraw();
    });
  }

  detach(): void {
    if (this.color && this.active) {
      process.stdout.write("\x1b[?25h\x1b[?1049l");
    }
    this.active = false;
  }

  snapshot(): string {
    return this.render(false);
  }

  get stepCount(): number {
    return this.steps;
  }

  private push(label: string, text: string, tone: TimelineEntry["tone"]): void {
    this.timeline.push({ label, text, tone });
    if (this.timeline.length > this.maxTimeline) {
      this.timeline.shift();
    }
  }

  private summarizeValue(value: unknown): string {
    if (typeof value === "string") {
      const first = value.split("\n").find((line) => line.trim() !== "") ?? "";
      return `ok: ${first.slice(0, 60)}`;
    }
    const record = value as Record<string, unknown>;
    if (record && typeof record === "object") {
      const stdout = record.stdout;
      if (typeof stdout === "string") {
        const first = stdout.split("\n").find((line) => line.trim() !== "") ?? "";
        return `ok: stdout="${first.slice(0, 60)}"`;
      }
      if ("ok" in record) {
        return `ok: ${JSON.stringify(value).slice(0, 80)}`;
      }
    }
    return `ok: ${JSON.stringify(value).slice(0, 80)}`;
  }

  private collectDiff(value: unknown): void {
    const record = value as Record<string, unknown>;
    const stdout = record && typeof record === "object" ? record.stdout : undefined;
    if (typeof stdout !== "string" || stdout.trim() === "") return;
    const lines = stdout.split("\n");
    const looksLikeDiff = lines.some((line) => line.startsWith("diff --git ") || line.startsWith("@@ "));
    if (looksLikeDiff) {
      this.diff = lines.slice(0, this.maxDiffLines);
    }
  }

  private redraw(): void {
    if (!this.color || !this.active) return;
    process.stdout.write("\x1b[H\x1b[2J");
    process.stdout.write(this.render(true));
  }

  private render(colored: boolean): string {
    const paint = (text: string, code: string): string => (colored ? `${code}${text}${ANSI.reset}` : text);

    const runLabel = this.runLabel !== "" ? this.runLabel : this.runId.slice(0, 8) || "—";
    const header = `RUN ${runLabel} · ${this.status}`;
    const inputLines = this.wrap(`输入: ${this.input}`, PANEL_WIDTH - 4);

    const thinkingLines = this.wrap(this.thinking.trim() === "" ? "—" : this.thinking, PANEL_WIDTH - 4);

    const timelineLines = this.timeline.map((entry, index) => {
      const label = entry.label.padEnd(7);
      const text = entry.text.slice(0, PANEL_WIDTH - 4 - label.length - 5);
      const tone =
        entry.tone === "ok" ? ANSI.green : entry.tone === "error" ? ANSI.red : entry.label === "model" ? ANSI.yellow : ANSI.cyan;
      return `${paint(`#${index + 1}`, ANSI.dim)} ${paint(label, tone)}${text}`;
    });

    const diffLines = this.diff.length > 0 ? this.diff : ["（无 diff）"];
    const diffRendered = diffLines.map((line) => {
      if (line.startsWith("diff --git ") || line.startsWith("--- ") || line.startsWith("+++ ") || line.startsWith("@@ ")) {
        return paint(line, ANSI.cyan);
      }
      if (line.startsWith("+")) return paint(line, ANSI.green);
      if (line.startsWith("-")) return paint(line, ANSI.red);
      return line;
    });

    const footer = `TOKENS ${this.tokensIn} in / ${this.tokensOut} out · ${this.steps} 步 · ${this.status}`;

    const sections: string[] = [];
    sections.push(this.panel("RUN", [header, ...inputLines.map((l) => `   ${l}`)], paint));
    sections.push(this.panel("THINKING", thinkingLines, paint));
    sections.push(this.panel("TIMELINE", timelineLines.length > 0 ? timelineLines : ["—"], paint));
    sections.push(this.panel("DIFF", diffRendered, paint));
    sections.push(this.panel("FOOTER", [footer], paint));
    return sections.join("\n") + "\n";
  }

  private panel(title: string, lines: string[], paint: (text: string, code: string) => string): string {
    const W = PANEL_WIDTH;
    const inner = W - 4;
    const top = `┌${paint(` ${title} `, ANSI.cyan)}${"─".repeat(W - 2 - title.length - 2)}┐`;
    const bottom = `└${"─".repeat(W - 2)}┘`;
    const body = lines.map((line) => {
      const trimmed = line.length > inner ? line.slice(0, inner) : line;
      return `│ ${trimmed.padEnd(inner)} │`;
    });
    return [top, ...body, bottom].join("\n");
  }

  private wrap(text: string, width: number): string[] {
    const lines: string[] = [];
    let current = "";
    for (const char of text) {
      if (char === "\n" || current.length >= width) {
        lines.push(current);
        current = char === "\n" ? "" : char;
        continue;
      }
      current += char;
    }
    if (current !== "") lines.push(current);
    return lines.length > 0 ? lines : [""];
  }
}