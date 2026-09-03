import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  PermissionError,
  RuntimeError,
  getActiveRuntimeScope,
  type Tool,
  type ToolCall,
  type ToolRegistry,
  type ToolResult,
} from "@hello-harness/core";
import type { Skill, SkillRegistry } from "@hello-harness/extensions";
import type { Workspace } from "../workspace/workspace";

export interface ReadSkillResourceInput {
  skill?: unknown;
  path?: unknown;
}

export interface RunSkillScriptInput {
  skill?: unknown;
  path?: unknown;
  args?: unknown;
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function quoteShellArg(value: string): string {
  return `"${value.replace(/"/g, '\\"')}"`;
}

/**
 * SkillHost 是 Skill 包与宿主环境之间的边界，不是新的 Agent Runtime。
 *
 * Skill 只描述工作流；Host 负责把它附带的资源和脚本映射到已有的
 * Workspace / ToolRegistry。脚本最终仍以 bash Tool 调用执行，因此继续
 * 经过 Permission Gate、Events 和 Hooks。
 */
export class SkillHost {
  private sequence = 0;
  private readonly loaded = new Set<string>();

  constructor(
    private readonly skills: SkillRegistry,
    private readonly tools: ToolRegistry,
    private readonly workspace: Workspace,
  ) {}

  load(name: string): Skill {
    const skill = this.skills.get(name);
    if (!skill) throw new RuntimeError(`未知技能：${name}`);
    return skill;
  }

  markLoaded(name: string): void {
    this.load(name);
    this.loaded.add(name);
  }

  private resolveFile(name: string, relativePath: string, area: "resource" | "script"): { skill: Skill; workspacePath: string; absolutePath: string } {
    const skill = this.load(name);
    if (!this.loaded.has(name)) {
      throw new RuntimeError(`技能尚未加载：${name}，请先调用 load_skill`);
    }
    if (typeof relativePath !== "string" || relativePath.trim() === "") {
      throw new RuntimeError("技能资源路径不能为空");
    }
    if (path.isAbsolute(relativePath)) {
      throw new PermissionError(`技能资源必须使用相对路径：${relativePath}`);
    }

    const target = path.resolve(skill.dir, relativePath);
    const insideSkill = path.relative(skill.dir, target);
    if (insideSkill === "" || insideSkill === ".." || insideSkill.startsWith(`..${path.sep}`) || path.isAbsolute(insideSkill)) {
      throw new PermissionError(`技能资源超出技能目录，拒绝访问：${relativePath}`);
    }

    const normalized = insideSkill.split(path.sep).join("/");
    if (area === "script" && !normalized.startsWith("scripts/")) {
      throw new PermissionError(`只能执行技能 scripts/ 目录内的文件：${relativePath}`);
    }
    if (area === "resource" && normalized === "SKILL.md") {
      throw new RuntimeError("SKILL.md 正文请通过 load_skill 加载");
    }

    const workspacePath = path.relative(this.workspace.root, target);
    this.workspace.resolve(workspacePath, "访问技能资源");
    return { skill, workspacePath, absolutePath: target };
  }

  async readResource(name: string, relativePath: string): Promise<string> {
    const { absolutePath } = this.resolveFile(name, relativePath, "resource");
    try {
      return await readFile(absolutePath, "utf-8");
    } catch (error) {
      throw new RuntimeError(`读取技能资源失败：${relativePath}（${errorText(error)}）`);
    }
  }

  async runScript(name: string, relativePath: string, args: string[] = []): Promise<ToolResult> {
    const { workspacePath } = this.resolveFile(name, relativePath, "script");
    const command = ["node", quoteShellArg(workspacePath), ...args.map(quoteShellArg)].join(" ");
    const call: ToolCall = {
      id: `skill-script-${++this.sequence}`,
      name: "bash",
      arguments: { command },
    };
    const scope = getActiveRuntimeScope();
    return this.tools.execute(call, scope ? { runId: scope.runId, events: scope.events, hooks: scope.hooks } : undefined);
  }
}

export function createReadSkillResourceTool(host: SkillHost): Tool {
  return {
    name: "read_skill_resource",
    description: "读取已加载 Skill 目录内的 references、assets 或 examples 等相对资源；禁止绝对路径和目录穿越",
    parameters: {
      type: "object",
      properties: {
        skill: { type: "string", description: "技能名，例如 internal-comms" },
        path: { type: "string", description: "Skill 目录内的相对路径，例如 examples/3p-updates.md" },
      },
      required: ["skill", "path"],
    },
    async execute(input: unknown): Promise<ToolResult> {
      const { skill, path: resourcePath } = input as ReadSkillResourceInput;
      if (typeof skill !== "string" || typeof resourcePath !== "string") {
        return { ok: false, error: "参数 skill 和 path 必须是字符串", kind: "tool", retryable: false };
      }
      try {
        return { ok: true, value: await host.readResource(skill, resourcePath) };
      } catch (error) {
        return {
          ok: false,
          error: errorText(error),
          kind: error instanceof PermissionError ? "permission" : "tool",
          retryable: false,
        };
      }
    },
  };
}

export function createRunSkillScriptTool(host: SkillHost): Tool {
  return {
    name: "run_skill_script",
    description: "运行 Skill scripts/ 目录内的 Node 辅助脚本；脚本仍经过宿主的 bash、Workspace 和 Permission Gate",
    parameters: {
      type: "object",
      properties: {
        skill: { type: "string", description: "技能名" },
        path: { type: "string", description: "scripts/ 目录内的相对路径" },
        args: { type: "array", items: { type: "string" }, description: "可选脚本参数" },
      },
      required: ["skill", "path"],
    },
    async execute(input: unknown): Promise<ToolResult> {
      const { skill, path: scriptPath, args } = input as RunSkillScriptInput;
      if (typeof skill !== "string" || typeof scriptPath !== "string") {
        return { ok: false, error: "参数 skill 和 path 必须是字符串", kind: "tool", retryable: false };
      }
      if (args !== undefined && (!Array.isArray(args) || args.some((arg) => typeof arg !== "string"))) {
        return { ok: false, error: "参数 args 必须是字符串数组", kind: "tool", retryable: false };
      }
      try {
        return await host.runScript(skill, scriptPath, (args as string[] | undefined) ?? []);
      } catch (error) {
        return {
          ok: false,
          error: errorText(error),
          kind: error instanceof PermissionError ? "permission" : "tool",
          retryable: false,
        };
      }
    },
  };
}
