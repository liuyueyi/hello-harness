import { RuntimeError } from "../core/errors/errors";

export interface Skill {
  name: string;
  description: string;
  content: string;
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