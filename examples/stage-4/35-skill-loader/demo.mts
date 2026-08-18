import path from "node:path";
import { SkillRegistry } from "../../../src/skill/skill";
import { SkillLoader, parseFrontmatter, SKILL_NAME_RE } from "../../../src/skill/loader";

async function main() {
  console.log("=== 35 · Skill Loader：加载业界标准的技能 ===");

  console.log("\n=== 1. 真 YAML：多行 description、嵌套 metadata 都能解析 ===");
  const yamlSample = `---
name: git-workflow
description: >-
  遵循仓库约定的 Git 提交与分支规范时使用：
  小步提交、清晰信息、干净历史。
license: MIT
metadata:
  owner: platform
---`;
  const parsedYaml = parseFrontmatter(yamlSample);
  console.log("  parseFrontmatter(多行 YAML) →");
  console.log(`    name: ${parsedYaml.metadata.name}`);
  console.log(`    description: ${parsedYaml.metadata.description}`);
  console.log(`    metadata.owner: ${(parsedYaml.metadata.metadata as { owner: string }).owner}`);
  console.log("  旧版「YAML 子集」解析在这里就会断；yaml 库完整支持");

  console.log("\n=== 2. 老格式（无 frontmatter）仍可降级 ===");
  const legacy = "# refactor\n\n重构现有代码时使用：保持行为不变，只改结构。\n\n## 流程\n...";
  const legacyParsed = parseFrontmatter(legacy);
  console.log(`  parseFrontmatter(老格式) → metadata={} · 全文当 content（description 回退到 # 标题行）`);

  console.log("\n=== 3. 加载我们自己的 .skills/（标准布局） ===");
  const loader = new SkillLoader(".skills");
  for (const skill of loader.loadSync()) {
    console.log(
      `  ${skill.name.padEnd(12)} · ${skill.description.slice(0, 18)}… · scripts=${JSON.stringify(skill.scripts)} · references=${JSON.stringify(skill.references)}`,
    );
  }

  console.log("\n=== 4. 加载真实的业界技能（anthropics/skills 官方仓库） ===");
  const realLoader = new SkillLoader(path.join("examples", "stage-4", "35-skill-loader", "fixtures"));
  for (const skill of realLoader.loadSync()) {
    console.log(`  name: ${skill.name}`);
    console.log(`  description: ${skill.description.slice(0, 70)}…`);
    console.log(`  正文 ${skill.content.length} 字符，正文引用 examples/ 子目录（按需加载，不枚举进清单）`);
  }

  console.log("\n=== 5. name 校验（kebab-case） ===");
  console.log(`  SKILL_NAME_RE.test("git-workflow") → ${SKILL_NAME_RE.test("git-workflow")}`);
  console.log(`  SKILL_NAME_RE.test("Git Workflow") → ${SKILL_NAME_RE.test("Git Workflow")}`);
  console.log(`  SKILL_NAME_RE.test("my_skill")      → ${SKILL_NAME_RE.test("my_skill")}`);

  console.log("\n=== 6. 注册进 ctx.skills ===");
  const skills = new SkillRegistry();
  const loaded = [...loader.loadSync(), ...realLoader.loadSync()];
  for (const skill of loaded) skills.register(skill);
  console.log(`  skills.list() → ${skills.list().map((s) => s.name).join(" / ")}`);
  console.log(`  get(internal-comms).description → ${skills.get("internal-comms")?.description.slice(0, 52)}…`);
}

main();