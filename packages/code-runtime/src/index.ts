export type { CodeRuntime, RuntimeFailure, RuntimeResult, RuntimeState, RuntimeStateEntry, RuntimeSuccess } from "./runtime";
export { emptyRuntimeState } from "./runtime";
export { JavaScriptRuntime } from "./javascript";
export type { JavaScriptLanguage, JavaScriptRuntimeOptions } from "./javascript";
export { PythonRuntime } from "./python";
export type { PythonRuntimeOptions } from "./python";
export { createCapabilitySet } from "./capability";
export type { Capability, CapabilityHandler, CapabilitySet } from "./capability";

// 语言与运行时构造器抽到独立模块，避免与工具模块形成循环依赖。
export type { RuntimeLanguage, CreateCodeRuntimeOptions } from "./create";
export { createCodeRuntime } from "./create";

// 代码即动作（Code as Action）工具：把模型生成的代码包装为受控 Tool。
export { createCodeActionTool, CODE_ACTION_TOOL_NAME } from "./tool";
export type { CodeActionToolOptions } from "./tool";
