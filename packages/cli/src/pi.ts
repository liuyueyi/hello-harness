import type { Model } from "@hello-harness/core";
import type { AgentRuntimeOptions } from "@hello-harness/core";
import type { ToolRegistry } from "@hello-harness/core";
import type { HookManager } from "@hello-harness/core";
import type { PermissionGate } from "@hello-harness/core";
import type { Workspace } from "@hello-harness/coding";
import { PiTui } from "./pi-tui";

export interface PiDeps {
  model: Model;
  workspace: Workspace;
  registry: ToolRegistry;
  hooks: HookManager;
  gate?: PermissionGate;
  systemPrompt: string;
  options: AgentRuntimeOptions;
  confirmTools?: boolean;
}

export async function runPi(deps: PiDeps): Promise<void> {
  const tui = new PiTui(deps);
  await tui.start();
}
