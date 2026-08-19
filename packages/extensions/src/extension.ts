import type { ToolRegistry, HookManager } from "@hello-harness/core";
import type { PromptRegistry } from "./prompt/prompt";
import type { SkillRegistry } from "./skill/skill";

export interface ExtensionContext {
  readonly name: string;
  log(message: string): void;
  readonly tools: ToolRegistry;
  readonly hooks: HookManager;
  readonly prompts: PromptRegistry;
  readonly skills: SkillRegistry;
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
