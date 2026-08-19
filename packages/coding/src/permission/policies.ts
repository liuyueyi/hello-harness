import type { ToolCall } from "@hello-harness/core";
import { PermissionGate } from "@hello-harness/core";
import type { PermissionDecision, PermissionPolicy } from "@hello-harness/core";

const DANGEROUS_COMMAND_RE =
  /\b(rm\s+-rf|del\s+\/q|rd\s+\/s|format\s+[a-z]:|drop\s+database|git\s+push\s+--force|shutdown|mkfs\.)\b/i;

export function denyDangerousCommands(): PermissionPolicy {
  return {
    name: "deny-dangerous-command",
    description: "bash 里的危险命令（rm -rf / del /q / rd /s / drop database / git push --force 等）直接拒绝",
    check(call: ToolCall): PermissionDecision {
      if (call.name !== "bash") return { action: "allow" };
      const command = String((call.arguments as { command?: unknown })?.command ?? "");
      if (DANGEROUS_COMMAND_RE.test(command)) {
        return { action: "deny", reason: `bash 命令包含危险操作（rm -rf 等），禁止执行：${command}` };
      }
      return { action: "allow" };
    },
  };
}

const PROTECTED_PATH_RE = /(^|[\\/])\.env($|\.)|\.sessions[\\/]|\.git[\\/]|\.secret$/i;

export function denyProtectedFiles(): PermissionPolicy {
  return {
    name: "deny-protected-files",
    description: "write / edit 的目标是 .env / .sessions / .git 等敏感路径时直接拒绝",
    check(call: ToolCall): PermissionDecision {
      if (call.name !== "write" && call.name !== "edit") return { action: "allow" };
      const args = call.arguments as { path?: unknown; filePath?: unknown };
      const filePath = String(args.path ?? args.filePath ?? "");
      if (PROTECTED_PATH_RE.test(filePath)) {
        return { action: "deny", reason: `目标路径属于敏感文件（${filePath}），禁止写入` };
      }
      return { action: "allow" };
    },
  };
}

const READONLY_TOOLS = new Set(["calculator", "random", "read", "load_skill"]);

export function allowReadonlyTools(): PermissionPolicy {
  return {
    name: "allow-readonly-tools",
    description: "calculator / random / read / load_skill 只读不改世界，直接放行",
    check(call: ToolCall): PermissionDecision {
      if (READONLY_TOOLS.has(call.name)) {
        return { action: "allow", reason: `${call.name} 是只读工具，无副作用` };
      }
      return { action: "allow" };
    },
  };
}

const READONLY_BASH_ARGS_RE = /^(ls|dir|pwd|cd|type|where|find|grep|cat|head|tail|echo)(\s+.*)?$/i;
const READONLY_BASH_NODE_RE = /^node\s+(-v|--version)$/i;
const READONLY_BASH_GIT_RE = /^git\s+(status|log|diff|branch|ls-files|remote|config|show)(\s+.*)?$/i;
const COMMAND_SEPARATOR_RE = /&&|\|\||;|\||`|\$\(/;

export function isReadonlyBashCommand(command: string): boolean {
  const trimmed = command.trim();
  if (COMMAND_SEPARATOR_RE.test(trimmed)) return false;
  return (
    READONLY_BASH_ARGS_RE.test(trimmed) ||
    READONLY_BASH_NODE_RE.test(trimmed) ||
    READONLY_BASH_GIT_RE.test(trimmed)
  );
}

export function allowReadonlyBash(): PermissionPolicy {
  return {
    name: "allow-readonly-bash",
    description: "bash 里整条命令都是只读操作（ls / dir / cd / pwd / grep / cat / node -v / git status 等）直接放行；拼接了多条命令的不在此列，交给 ask",
    check(call: ToolCall): PermissionDecision {
      if (call.name !== "bash") return { action: "allow" };
      const command = String((call.arguments as { command?: unknown })?.command ?? "");
      if (isReadonlyBashCommand(command)) {
        return { action: "allow", reason: `只读命令（${command.trim()}），无副作用` };
      }
      return { action: "allow" };
    },
  };
}

export function askSideEffectingTools(): PermissionPolicy {
  return {
    name: "ask-side-effecting-tools",
    description: "其余会改世界或执行命令的操作（write / edit / bash 里的非只读命令）默认询问用户",
    check(_call: ToolCall): PermissionDecision {
      return { action: "ask", reason: "该操作有副作用，需要用户确认" };
    },
  };
}

export function createDefaultPermissionGate(): PermissionGate {
  const gate = new PermissionGate();
  gate.add(denyDangerousCommands());
  gate.add(denyProtectedFiles());
  gate.add(allowReadonlyTools());
  gate.add(allowReadonlyBash());
  gate.add(askSideEffectingTools());
  return gate;
}
