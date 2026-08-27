import type { AgentContext, ContextFilter, ContextSearchOptions, Role } from "@hello-harness/core";
import type { CodeRuntime } from "@hello-harness/code-runtime";
import type { Capability, CapabilityHandler } from "@hello-harness/code-runtime";

/**
 * 面向模型的 Context façade。
 *
 * 它不是 Context 数据模型：Conversation 的 entries / search / filter 在 core，
 * Runtime State 的 describe 在 code-runtime。本文件只在 Coding 组装层把两者
 * 挂到同一个 `context` Capability 命名空间，避免 core 反向依赖某种内核实现。
 */
export function createContextCapability(
  agentContext: AgentContext,
  codeRuntimeRef: { current: CodeRuntime },
): Capability {
  function roles(value: unknown): Role[] | undefined {
    const values = typeof value === "string" ? [value] : Array.isArray(value) ? value : undefined;
    if (!values) return undefined;
    const valid: Role[] = [];
    for (const value of values) {
      if (value === "system" || value === "user" || value === "assistant" || value === "tool") valid.push(value);
    }
    return valid;
  }

  function searchOptions(args: unknown): ContextSearchOptions {
    if (typeof args === "string") return { query: args };
    const value = args as Record<string, unknown> | undefined;
    return {
      query: typeof value?.query === "string" ? value.query : "",
      roles: roles(value?.roles),
      offset: typeof value?.offset === "number" ? value.offset : undefined,
      limit: typeof value?.limit === "number" ? value.limit : undefined,
    };
  }

  // Conversation-only actions: no kernel access, so they are safe while a cell runs.
  const search: CapabilityHandler = async (args: unknown) => agentContext.search(searchOptions(args));

  const slice: CapabilityHandler = async (args: unknown) => {
    const obj = args as Record<string, unknown> | undefined;
    const start = obj && typeof obj.start === "number" ? obj.start : 0;
    const end = obj && typeof obj.end === "number" ? obj.end : undefined;
    const entries = agentContext.entries();
    return { messages: entries.slice(start, end), total: entries.length };
  };

  const filter: CapabilityHandler = async (args: unknown) => {
    const value = args as Record<string, unknown> | undefined;
    const filter: ContextFilter = { roles: roles(value?.roles) };
    const messages = agentContext.filter(filter);
    return { messages, total: messages.length };
  };

  // Runtime-backed actions: they deliberately remain outside core. Calling
  // describe() from a running single-threaded Python cell is not safe; see ch48.
  const current: CapabilityHandler = async () => ({
    messages: agentContext.entries(),
    runtimeState: await codeRuntimeRef.current.describe(),
  });

  const summarize: CapabilityHandler = async () => {
    const entries = agentContext.entries();
    const runtimeState = await codeRuntimeRef.current.describe();
    return {
      messageCounts: {
        user: entries.filter((entry) => entry.role === "user").length,
        assistant: entries.filter((entry) => entry.role === "assistant").length,
        tool: entries.filter((entry) => entry.role === "tool").length,
      },
      totalMessages: entries.length,
      runtimeVariables: runtimeState.variables.length,
      runtimeAlive: runtimeState.alive,
    };
  };

  const getRuntimeState: CapabilityHandler = async () => codeRuntimeRef.current.describe();

  return {
    name: "context",
    description: "A Coding-layer façade over Conversation (core) and Runtime State (code-runtime). Use context.search({query, roles?, offset?, limit?}) for ranked local conversation search; context.filter({roles}) and context.slice(start, end) need no kernel; current/summarize/getRuntimeState also read Runtime State.",
    actions: { current, search, slice, filter, summarize, getRuntimeState },
  };
}
