import type { ToolRegistry } from "../core/tool/registry";
import type { HookManager } from "../core/hooks/hooks";
import type { PromptRegistry } from "../prompt/prompt";

export interface ExtensionContext {
  readonly name: string;
  log(message: string): void;
  readonly tools: ToolRegistry;
  readonly hooks: HookManager;
  readonly prompts: PromptRegistry;
}

export interface Extension {
  name: string;
  version?: string;
  description?: string;
  setup(ctx: ExtensionContext): void;
}

export function defineExtension(extension: Extension): Extension {
  return extension;
}
