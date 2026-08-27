import { Workspace } from "./workspace/workspace";
import type { AgentContext, PermissionGate, ToolCall } from "@hello-harness/core";
import type { CodeRuntime } from "@hello-harness/code-runtime";
import type { Capability, CapabilityHandler } from "@hello-harness/code-runtime";

/**
 * 向权限门查询一次能力调用是否被允许。
 *
 * capability 没有自己的「名字空间」，为了复用 core 里为 tool 设计的权限策略
 * （denyProtectedFiles / denyDangerousCommands / allowReadonly* / askSideEffectingTools），
 * 这里把 capability 动作映射成对应的「规范工具名」：
 *   fs.read / fs.list → read（只读，默认放行）
 *   fs.write         → write（受保护文件会被 deny，其余 ask）
 *   shell.run        → bash（危险命令 deny，只读命令放行，其余 ask）
 *
 * 若未传入 gate（如 --no-permissions），直接放行。
 */
async function checkCapabilityPermission(
  gate: PermissionGate | undefined,
  capability: string,
  action: string,
  toolName: string,
  args: unknown,
): Promise<{ allowed: boolean; reason?: string }> {
  if (!gate) return { allowed: true };
  const call: ToolCall = { id: `cap:${capability}.${action}`, name: toolName, arguments: args };
  const result = await gate.check(call);
  return { allowed: result.allowed, reason: result.decision.reason };
}

/** 创建 fs capability（读/写/列表），受 workspace 路径限制与权限门保护。 */
export function createFsCapability(workspace: Workspace, gate?: PermissionGate): Capability {
  const read: CapabilityHandler = async (args: unknown) => {
    const path = typeof args === "string" ? args : String((args as Record<string, unknown>)?.path ?? "");
    workspace.resolve(path); // 会抛出 PermissionError 如果越界
    console.log(`[cap:fs.read] ${path}`);
    return workspace.read(path);
  };

  const write: CapabilityHandler = async (args: unknown) => {
    const path = typeof args === "string" ? args : String((args as Record<string, unknown>)?.path ?? "");
    const content = String((args as Record<string, unknown>)?.content ?? "");
    workspace.resolve(path); // 越界先拒绝（路径边界是比权限门更硬的边界）
    const verdict = await checkCapabilityPermission(gate, "fs", "write", "write", { path, content });
    if (!verdict.allowed) {
      console.log(`[cap:fs.write] ✗ 权限拒绝：${verdict.reason ?? "未授权"}`);
      return { ok: false, error: verdict.reason ?? "permission denied", kind: "permission", retryable: false };
    }
    console.log(`[cap:fs.write] ✓ 写入 ${path}（${content.length} 字节）`);
    await workspace.write(path, content);
    return { ok: true };
  };

  const list: CapabilityHandler = async (args: unknown) => {
    const path = typeof args === "string" ? args : String((args as Record<string, unknown>)?.path ?? ".");
    const target = workspace.resolve(path);
    console.log(`[cap:fs.list] ${path}`);
    const { readdir } = await import("node:fs/promises");
    const entries = await readdir(target, { withFileTypes: true });
    return entries.map(e => ({ name: e.name, isDirectory: e.isDirectory() }));
  };

  return {
    name: "fs",
    description: "Workspace-scoped file system operations (read/write/list)",
    actions: { read, write, list },
  };
}

/** 创建 shell capability（运行命令），受 workspace cwd 限制与权限门保护。 */
export function createShellCapability(workspace: Workspace, gate?: PermissionGate): Capability {
  const run: CapabilityHandler = async (args: unknown) => {
    const command = typeof args === "string" ? args : String((args as Record<string, unknown>)?.command ?? "");
    workspace.resolve("."); // 确保 cwd 在 workspace 内
    const verdict = await checkCapabilityPermission(gate, "shell", "run", "bash", { command });
    if (!verdict.allowed) {
      console.log(`[cap:shell.run] ✗ 权限拒绝：${verdict.reason ?? "未授权"}`);
      return { ok: false, error: verdict.reason ?? "permission denied", kind: "permission", retryable: false };
    }
    console.log(`[cap:shell.run] ${command}`);

    const { spawn } = await import("node:child_process");
    const cwd = workspace.root;

    return new Promise((resolve, reject) => {
      let stdout = "";
      let stderr = "";
      const child = spawn(command, { shell: true, cwd, stdio: ["ignore", "pipe", "pipe"] });
      child.stdout?.setEncoding("utf8").on("data", d => stdout += d);
      child.stderr?.setEncoding("utf8").on("data", d => stderr += d);
      child.on("error", reject);
      child.on("close", code => {
        if (code === 0) resolve({ stdout, stderr, exitCode: 0 });
        else resolve({ stdout, stderr, exitCode: code ?? 1 });
      });
    });
  };

  return {
    name: "shell",
    description: "Run shell commands within workspace",
    actions: { run },
  };
}

/**
 * 创建 context capability：把 Context（对话历史 + Runtime State）变成内核里
 * 可编程操作的变量。这是「Context as Variable」的落地——模型可以主动
 * 检索、切片、摘要自己的上下文，而不再是被动接收哈塞推送的观察。
 *
 * codeRuntime 通过一个可变引用传入（{ current: CodeRuntime }），允许在
 * CodeRuntime 构造后再设置，从而打破「内核构造需能力、能力需内核」的循环依赖。
 */
export function createContextCapability(
  agentContext: AgentContext,
  codeRuntimeRef: { current: CodeRuntime },
): Capability {
  /** 把 AgentContext 的 messages 转成可序列化的简化结构。 */
  function messagesToEntries(): Array<{ role: string; content: string }> {
    return agentContext.messages.map(m => ({
      role: m.role,
      content: typeof m.content === "string" ? m.content : JSON.stringify(m.content),
    }));
  }

  const current: CapabilityHandler = async () => {
    const runtimeState = await codeRuntimeRef.current.describe();
    return {
      messages: messagesToEntries(),
      runtimeState,
    };
  };

  const search: CapabilityHandler = async (args: unknown) => {
    const query = typeof args === "string" ? args : String((args as Record<string, unknown>)?.query ?? "");
    if (!query.trim()) return { results: [], total: 0 };
    const entries = messagesToEntries();
    const lowerQuery = query.toLowerCase();
    const results = entries
      .map((entry, index) => ({
        index,
        role: entry.role,
        snippet: entry.content.slice(0, 200),
        score: entry.content.toLowerCase().includes(lowerQuery) ? 1 : 0,
      }))
      .filter(r => r.score > 0);
    return { results, total: results.length };
  };

  const slice: CapabilityHandler = async (args: unknown) => {
    const obj = args as Record<string, unknown> | undefined;
    const start = obj && typeof obj.start === "number" ? obj.start : 0;
    const end = obj && typeof obj.end === "number" ? obj.end : undefined;
    const entries = messagesToEntries();
    const sliced = entries.slice(start, end);
    return { messages: sliced, total: entries.length };
  };

  const summarize: CapabilityHandler = async () => {
    const entries = messagesToEntries();
    const userCount = entries.filter(e => e.role === "user").length;
    const assistantCount = entries.filter(e => e.role === "assistant").length;
    const toolCount = entries.filter(e => e.role === "tool").length;
    const runtimeState = await codeRuntimeRef.current.describe();
    return {
      messageCounts: { user: userCount, assistant: assistantCount, tool: toolCount },
      totalMessages: entries.length,
      runtimeVariables: runtimeState.variables.length,
      runtimeAlive: runtimeState.alive,
    };
  };

  const getRuntimeState: CapabilityHandler = async () => {
    return codeRuntimeRef.current.describe();
  };

  return {
    name: "context",
    description: "Programmatic access to the agent's context (conversation + runtime state). Use context.current() to get everything, context.search(query) to find relevant parts, context.slice(start, end) to paginate, context.summarize() for an overview.",
    actions: { current, search, slice, summarize, getRuntimeState },
  };
}

/** 便捷函数：一次性创建标准的 Coding Agent capability 集合（fs + shell）。 */
export function createCodingCapabilities(workspace: Workspace, gate?: PermissionGate): Capability[] {
  return [
    createFsCapability(workspace, gate),
    createShellCapability(workspace, gate),
  ];
}