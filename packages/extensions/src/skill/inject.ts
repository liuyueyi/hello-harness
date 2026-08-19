import type { Skill } from "./skill";
import { MAX_SKILLS_LOADED } from "./skill";

export function renderSkillCatalog(skills: Skill[], maxLoaded = MAX_SKILLS_LOADED): string {
  if (skills.length === 0) return "";
  const lines = skills.map((skill) => `- ${skill.name}：${skill.description}`);
  return `【可用技能】\n本次任务可使用以下技能。需要某个技能时，调用 load_skill 工具加载其完整正文与配套能力（scripts/references/assets）；同一技能重复加载会走缓存；最多同时加载 ${maxLoaded} 个。\n\n${lines.join("\n")}\n`;
}

export function injectSkillCatalog(systemPrompt: string, catalog: string): string {
  if (catalog === "") return systemPrompt;
  return `${systemPrompt.trim()}\n\n${catalog}`;
}