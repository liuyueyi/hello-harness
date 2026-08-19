import type { Tool, ToolResult } from "@hello-harness/core";
import type { SkillRegistry } from "@hello-harness/extensions";
import { MAX_SKILLS_LOADED } from "@hello-harness/extensions";

export interface SkillInput {
  name?: unknown;
}

export function createSkillTool(registry: SkillRegistry, options: { maxLoaded?: number } = {}): Tool {
  const maxLoaded = options.maxLoaded ?? MAX_SKILLS_LOADED;
  const loaded = new Map<string, ReturnType<SkillRegistry["get"]>>();

  return {
    name: "load_skill",
    description: `加载一个技能的完整正文与配套能力。技能名必须在【可用技能】清单里；同一技能重复加载直接返回已加载内容（不重复计数）；最多同时加载 ${maxLoaded} 个，超过会被拒绝。`,
    parameters: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "技能名，例如 debugging",
        },
      },
      required: ["name"],
    },
    async execute(input: unknown): Promise<ToolResult> {
      const { name } = input as SkillInput;
      if (typeof name !== "string" || name.trim() === "") {
        return { ok: false, error: "参数 name 必须是技能名字符串", kind: "tool", retryable: false };
      }
      const skill = registry.get(name);
      if (!skill) {
        const available = registry.list().map((s) => s.name).join(", ") || "（无）";
        return { ok: false, error: `未知技能：${name}，可用技能：${available}`, kind: "tool", retryable: false };
      }
      const existing = loaded.get(name);
      if (existing) {
        return {
          ok: true,
          value: {
            name,
            cached: true,
            content: existing.content,
            dir: existing.dir,
            scripts: existing.scripts ?? [],
            references: existing.references ?? [],
            assets: existing.assets ?? [],
            loaded: loaded.size,
            maxLoaded,
          },
        };
      }
      if (loaded.size >= maxLoaded) {
        return {
          ok: false,
          error: `已加载 ${loaded.size} 个技能（上限 ${maxLoaded}），不再加载更多`,
          kind: "tool",
          retryable: false,
        };
      }
      loaded.set(name, skill);
      return {
        ok: true,
        value: {
          name,
          cached: false,
          content: skill.content,
          dir: skill.dir,
          scripts: skill.scripts ?? [],
          references: skill.references ?? [],
          assets: skill.assets ?? [],
          loaded: loaded.size,
          maxLoaded,
        },
      };
    },
  };
}