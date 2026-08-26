import { Workspace } from "./workspace/workspace";
import type { Capability, CapabilityHandler } from "@hello-harness/code-runtime";

/** 创建 fs capability（读/写/列表），受 workspace 路径限制。 */
export function createFsCapability(workspace: Workspace): Capability {
  const read: CapabilityHandler = async (args: unknown) => {
    const path = typeof args === "string" ? args : String((args as Record<string, unknown>)?.path ?? "");
    workspace.resolve(path); // 会抛出 PermissionError 如果越界
    return workspace.read(path);
  };

  const write: CapabilityHandler = async (args: unknown) => {
    const path = typeof args === "string" ? args : String((args as Record<string, unknown>)?.path ?? "");
    const content = String((args as Record<string, unknown>)?.content ?? "");
    workspace.resolve(path);
    await workspace.write(path, content);
    return { ok: true };
  };

  const list: CapabilityHandler = async (args: unknown) => {
    const path = typeof args === "string" ? args : String((args as Record<string, unknown>)?.path ?? ".");
    const target = workspace.resolve(path);
    const { readdir } = await import("node:fs/promises");
    const entries = await readdir(target, { withFileTypes: true });
    return entries.map(e => ({ name: e.name, isDirectory: e.isDirectory() }));
  };

  return {
    name: "fs",
    description: "Workspace-scoped file system operations (read/write/list)",
    actions: { read, write, list },
  };
}

/** 创建 shell capability（运行命令），受 workspace cwd 限制。 */
export function createShellCapability(workspace: Workspace): Capability {
  const run: CapabilityHandler = async (args: unknown) => {
    const command = typeof args === "string" ? args : String((args as Record<string, unknown>)?.command ?? "");
    workspace.resolve("."); // 确保 cwd 在 workspace 内

    const { spawn } = await import("node:child_process");
    const cwd = workspace.root;

    return new Promise((resolve, reject) => {
      let stdout = "";
      let stderr = "";
      const child = spawn(command, { shell: true, cwd, stdio: ["ignore", "pipe", "pipe"] });
      child.stdout?.setEncoding("utf8").on("data", d => stdout += d);
      child.stderr?.setEncoding("utf8").on("data", d => stderr += d);
      child.on("error", reject);
      child.on("close", code => {
        if (code === 0) resolve({ stdout, stderr, exitCode: 0 });
        else resolve({ stdout, stderr, exitCode: code ?? 1 });
      });
    });
  };

  return {
    name: "shell",
    description: "Run shell commands within workspace",
    actions: { run },
  };
}

/** 便捷函数：一次性创建标准的 Coding Agent capability 集合（fs + shell）。 */
export function createCodingCapabilities(workspace: Workspace): Capability[] {
  return [
    createFsCapability(workspace),
    createShellCapability(workspace),
  ];
}