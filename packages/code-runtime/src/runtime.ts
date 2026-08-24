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

/**
 * 模型生成的 Code Action 的最小执行边界。
 *
 * 具体语言、进程/内核、Capability 注入、权限与持久化状态都属于实现，
 * 由后续章节逐步补齐；调用方只依赖执行和重置这两个生命周期动作。
 */
export interface CodeRuntime {
  execute(code: string): Promise<RuntimeResult>;

  reset(): Promise<void>;
}
