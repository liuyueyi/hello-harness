import { RuntimeError } from "@hello-harness/core";

export const MAX_SKILLS_LOADED = 3;

export interface Skill {
  name: string;
  description: string;
  content: string;
  dir: string;
  scripts?: string[];
  references?: string[];
  assets?: string[];
  /** Skill 目录中除 SKILL.md 外可按需读取的相对文件路径。 */
  resources?: string[];
  /**
   * SKILL.md frontmatter 的其余元数据。
   *
   * Skill 是工作流说明，不是可调用函数，因此这里不把 tools、
   * parameters、returns 解释成新的 Tool Schema。
   */
  metadata?: Record<string, unknown>;
}

export class SkillRegistry {
  private readonly skills = new Map<string, Skill>();

  register(skill: Skill): void {
    const name = skill.name;
    if (typeof name !== "string" || name.trim() === "") {
      throw new RuntimeError("技能名称不能为空");
    }
    if (this.skills.has(name)) {
      throw new RuntimeError(`技能 ${name} 已注册`);
    }
    this.skills.set(name, skill);
  }

  get(name: string): Skill | undefined {
    return this.skills.get(name);
  }

  list(): Skill[] {
    return [...this.skills.values()];
  }
}