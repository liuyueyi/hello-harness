import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { SkillRegistry } from "../../../src/skill/skill";
import { ExtensionRegistry, defineExtension } from "../../../src/extensions";
import { HookManager, ToolRegistry } from "../../../src/core";
import type { Skill } from "../../../src/skill/skill";

function loadSkills(dir: string): Skill[] {
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((entry) => {
      const content = readFileSync(path.join(dir, entry.name, "SKILL.md"), "utf-8");
      const description =
        content.split("\n").find((line) => line.startsWith("# "))?.replace(/^#\s*/, "").trim() ?? entry.name;
      return { name: entry.name, description, content };
    });
}

async function main() {
  console.log("=== 34 · Skill：技能不是工具 ===");

  console.log("\n=== 1. 从 .skills/*/SKILL.md 读取技能 ===");
  const loaded = loadSkills(".skills");
  for (const skill of loaded) {
    console.log(`  ${skill.name.padEnd(12)} ← .skills/${skill.name}/SKILL.md · ${skill.content.length} 字符`);
  }

  console.log("\n=== 2. 扩展通过 ctx.skills 注册（第四个能力） ===");
  const registry = new ToolRegistry();
  const hooks = new HookManager();
  const skills = new SkillRegistry();
  const extensions = new ExtensionRegistry({ tools: registry, hooks, skills });
  extensions.install(
    defineExtension({
      name: "hello-skills",
      description: "把 .skills/*/SKILL.md 注册为技能",
      setup(ctx) {
        for (const skill of loaded) ctx.skills.register(skill);
      },
    }),
  );
  console.log(`  skills.list() → ${skills.list().map((s) => s.name).join(" / ")}`);

  console.log("\n=== 3. 技能 ≠ 工具 ===");
  console.log(`  registry.list() → ${registry.list().map((t) => t.name).join(" / ") || "（空）"}`);
  const result = await registry.execute({ id: "x", name: "refactor", arguments: {} });
  console.log(`  execute(refactor) → ok=${result.ok} · ${result.error}`);
  console.log("  技能不参与 function calling —— 它是给 Agent 的知识，不是给 Agent 的手");

  console.log("\n=== 4. 技能的正文（这是将来要注入 Agent 的知识） ===");
  const refactor = skills.get("refactor");
  if (refactor) {
    console.log(refactor.content.split("\n").slice(0, 5).map((line) => `    ${line}`).join("\n"));
  }
  console.log("  （注入机制 ch36 见）");
}

main();