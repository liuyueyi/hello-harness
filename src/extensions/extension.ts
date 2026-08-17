import type { ToolRegistry } from "../core/tool/registry";

export interface ExtensionContext {
  readonly name: string;
  log(message: string): void;
  readonly tools: ToolRegistry;
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
