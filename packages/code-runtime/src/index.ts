export type { CodeRuntime, RuntimeFailure, RuntimeResult, RuntimeSuccess } from "./runtime";
export { JavaScriptRuntime } from "./javascript";
export type { JavaScriptLanguage, JavaScriptRuntimeOptions } from "./javascript";
export { PythonRuntime } from "./python";
export type { PythonRuntimeOptions } from "./python";

/** 当前 CodeRuntime 家族支持的输出语言；语言是实现的属性，而非 `CodeRuntime` 接口的参数。 */
export type RuntimeLanguage = "typescript" | "javascript" | "python";

import type { CodeRuntime } from "./runtime";
import { JavaScriptRuntime } from "./javascript";
import { PythonRuntime } from "./python";

export interface CreateCodeRuntimeOptions {
  /** 单段 Code Action 最长执行时间。 */
  timeoutMs?: number;
  /** 仅 PythonRuntime 使用：指定 Python 解释器命令。 */
  command?: string;
}

/** 按语言选择并构造对应的 CodeRuntime 实现，上层无需认识具体类。 */
export function createCodeRuntime(language: RuntimeLanguage, options: CreateCodeRuntimeOptions = {}): CodeRuntime {
  if (language === "python") {
    return new PythonRuntime({ timeoutMs: options.timeoutMs, command: options.command });
  }
  return new JavaScriptRuntime({ language, timeoutMs: options.timeoutMs });
}
