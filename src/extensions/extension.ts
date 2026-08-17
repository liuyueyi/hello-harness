import type { ToolRegistry } from "../core/tool/registry";
import type { HookManager } from "../core/hooks/hooks";

export interface ExtensionContext {
  readonly name: string;
  log(message: string): void;
  readonly tools: ToolRegistry;
  readonly hooks: HookManager;
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
