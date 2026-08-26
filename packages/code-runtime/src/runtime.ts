/** 一次代码执行成功后可观察到的最小结果。 */
export interface RuntimeSuccess {
  ok: true;
  stdout: string;
  stderr: string;
  value?: unknown;
  durationMs: number;
}

/** 一次代码执行失败后可观察到的最小结果。 */
export interface RuntimeFailure {
  ok: false;
  stdout: string;
  stderr: string;
  error: string;
  durationMs: number;
}

export type RuntimeResult = RuntimeSuccess | RuntimeFailure;

/** 内核全局命名空间里一个变量的最小描述：名字 / 类型 / 截断预览。 */
export interface RuntimeStateEntry {
  name: string;
  type: string;
  preview: string;
}

/**
 * Runtime State 摘要：持久内核当前「记得什么」。
 *
 * 这是 Context = Conversation + Runtime State 中「Runtime State」一侧的
 * 最小可观察形态——对话之外，内核里还活着哪些变量。
 */
export interface RuntimeState {
  /** 内核是否存活（尚未启动或已被 reset 时为 false）。 */
  alive: boolean;
  /** 模型创建的全局变量（不含 Capability 命名空间与内核自身符号）。 */
  variables: RuntimeStateEntry[];
}

/** describe() 返回为空（无内核）时的便捷构造。 */
export function emptyRuntimeState(alive = false): RuntimeState {
  return { alive, variables: [] };
}

/**
 * 模型生成的 Code Action 的最小执行边界。
 *
 * 具体语言、进程/内核、Capability 注入、权限与持久化状态都属于实现，
 * 由后续章节逐步补齐；调用方只依赖执行、描述状态和重置这三个生命周期动作。
 */
export interface CodeRuntime {
  execute(code: string): Promise<RuntimeResult>;

  /**
   * 描述内核当前的 Runtime State（全局变量清单）。
   *
   * 内核未启动 / 已被 reset 时返回 `{ alive: false, variables: [] }`，
   * 不会为了「看一眼状态」而拉起一个新内核。
   */
  describe(): Promise<RuntimeState>;

  reset(): Promise<void>;
}
