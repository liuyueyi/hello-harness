import { AgentRuntime } from "@hello-harness/core";
import type { AgentRuntimeOptions, Model, RunStatus, StopReason } from "@hello-harness/core";
import { Session } from "@hello-harness/core";
import { systemMessage, userMessage } from "@hello-harness/core";
import { getActiveRuntimeScope } from "@hello-harness/core";
import type { ToolRegistry } from "@hello-harness/core";

/**
 * ch47 · Agent as Function：LLM 调用本身成为可编程函数。
 *
 * `task` 工具内部调用 AgentSpawner.spawn()，创建一个带独立 Session 的 AgentRuntime——
 * 复用同一个 Model、同一个 ToolRegistry（权限门 / 事件 / Hook / 超时全部继承），
 * 子 Agent 与父程序之间唯一的边界就是"上下文范围"：它只看到任务描述，看不到父对话历史。
 */

export interface AgentSpawnOptions {
  // 子 Agent 的 system 提示；不传则子 Agent 只有任务描述
  system?: string;
}

export interface AgentFunctionResult {
  runId: string;
  sessionId: string;
  status: RunStatus;
  stopReason: StopReason;
  answer: string;
  iterations: number;
  steps: number;
  inputTokens: number;
  outputTokens: number;
  error?: string;
}

/**
 * AgentSpawner：把 AgentRuntime 包装成可编程调用的 task 工具。
 * 每个 spawn 都创建一个全新 Session（id = randomUUID），子 Agent 运行在其中，
 * 之后可以用 sessionId 追溯是哪一场子任务产出的结果。
 */
export class AgentSpawner {
  constructor(
    private readonly model: Model,
    private readonly registry: ToolRegistry,
    private readonly options: AgentRuntimeOptions = {},
  ) {}

  async spawn(task: string, options: AgentSpawnOptions = {}): Promise<AgentFunctionResult> {
    if (typeof task !== "string" || task.trim() === "") {
      throw new Error("task 工具需要非空的任务描述字符串");
    }

    // 子 Agent 的运行时选项继承构造期配置；Hook 若未显式配置，
    // 则沿用当前调用链的 active scope（父 Runtime 的 Hook 对子 Agent 同样触发）。
    // 注意：过滤掉 undefined 值，避免覆盖 AgentRuntime 构造函数的默认值。
    const scope = getActiveRuntimeScope();
    const parentOptions = this.options;
    const childOptions: AgentRuntimeOptions = {};
    if (parentOptions.maxSteps !== undefined) childOptions.maxSteps = parentOptions.maxSteps;
    if (parentOptions.timeoutMs !== undefined) childOptions.timeoutMs = parentOptions.timeoutMs;
    if (parentOptions.modelTimeoutMs !== undefined) childOptions.modelTimeoutMs = parentOptions.modelTimeoutMs;
    if (parentOptions.toolTimeoutMs !== undefined) childOptions.toolTimeoutMs = parentOptions.toolTimeoutMs;
    if (parentOptions.maxRetries !== undefined) childOptions.maxRetries = parentOptions.maxRetries;
    childOptions.hooks = parentOptions.hooks ?? scope?.hooks;
    const child = new AgentRuntime(this.model, this.registry, childOptions);

    // 子运行时的事件转发到当前调用链的事件流（runId 不同，可以在一条时间线上区分父子）。
    if (scope) {
      child.on("run:start", (e) => scope.events.emit(e));
      child.on("model:start", (e) => scope.events.emit(e));
      child.on("model:delta", (e) => scope.events.emit(e));
      child.on("model:reasoning", (e) => scope.events.emit(e));
      child.on("model:end", (e) => scope.events.emit(e));
      child.on("model:retry", (e) => scope.events.emit(e));
      child.on("tool:start", (e) => scope.events.emit(e));
      child.on("tool:end", (e) => scope.events.emit(e));
      child.on("step", (e) => scope.events.emit(e));
      child.on("run:end", (e) => scope.events.emit(e));
    }

    // 子 Session：上下文只由「父程序显式给的东西」构成——可选 system + 任务描述。
    const session = new Session();
    if (options.system) {
      session.context.add(systemMessage(options.system));
    }
    session.context.add(userMessage(task));

    const run = await child.runContext(session.context);
    const result: AgentFunctionResult = {
      runId: run.id,
      sessionId: session.id,
      status: run.status,
      stopReason: run.stopReason,
      answer: run.answer,
      iterations: run.iterations,
      steps: run.steps.length,
      inputTokens: run.inputTokens,
      outputTokens: run.outputTokens,
      ...(run.error ? { error: run.error } : {}),
    };
    return result;
  }
}
