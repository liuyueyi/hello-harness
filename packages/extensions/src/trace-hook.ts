import { defineExtension } from "./extension";

export interface TraceHookOptions {
  log?: (message: string) => void;
}

function shortArgs(argumentsValue: unknown): string {
  const text = JSON.stringify(argumentsValue);
  return text.length > 50 ? `${text.slice(0, 50)}…` : text;
}

export function createTraceHookExtension(options: TraceHookOptions = {}) {
  const runStartedAt = Date.now();
  const toolStartedAt = new Map<string, number>();

  return defineExtension({
    name: "trace-hook",
    version: "0.1.0",
    description: "Hook 机制演示：在 6 个运行节点打印 trace 日志（纯观察，不改请求）。",
    setup(ctx) {
      const log = options.log ?? ((message: string) => ctx.log(message));

      ctx.hooks.register("beforeRun", (e) => {
        log(`beforeRun   一轮运行开始 · 输入「${e.input}」`);
      });

      ctx.hooks.register("beforeModel", (e) => {
        log(`beforeModel 发请求 · 消息 ${e.request.messages.length} 条 · 工具 ${e.request.tools?.length ?? 0} 个`);
      });

      ctx.hooks.register("afterModel", (e) => {
        log(
          `afterModel  模型返回 · toolCalls ${e.response.toolCalls.length} 个 · ${e.response.inputTokens} in / ${e.response.outputTokens} out`,
        );
      });

      ctx.hooks.register("beforeTool", (e) => {
        toolStartedAt.set(e.call.id, Date.now());
        log(`beforeTool  即将执行 ${e.call.name}(${shortArgs(e.call.arguments)})`);
      });

      ctx.hooks.register("afterTool", (e) => {
        const elapsedMs = Date.now() - (toolStartedAt.get(e.call.id) ?? Date.now());
        toolStartedAt.delete(e.call.id);
        log(`afterTool   执行完成 · ${e.call.name} → ok=${e.result.ok} · ${elapsedMs}ms`);
      });

      ctx.hooks.register("afterRun", (e) => {
        const elapsedMs = Date.now() - runStartedAt;
        log(`afterRun    运行结束 · ${e.run.status} / ${e.run.stopReason} · ${e.run.steps.length} 步 · ${elapsedMs}ms`);
      });
    },
  });
}