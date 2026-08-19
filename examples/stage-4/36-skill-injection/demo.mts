import { readFileSync } from "node:fs";
import path from "node:path";
import { SkillLoader } from "@hello-harness/extensions";
import { SkillRegistry } from "@hello-harness/extensions";
import { ToolRegistry } from "@hello-harness/core";
import { renderSkillCatalog, injectSkillCatalog } from "@hello-harness/extensions";
import { createSkillTool } from "@hello-harness/coding";

async function main() {
  console.log("=== 36 · Skill Injection：渐进式加载 + 技能能力可用 ===");

  const registry = new SkillRegistry();
  for (const skill of new SkillLoader(".skills").loadSync()) {
    registry.register(skill);
  }
  for (const skill of new SkillLoader(path.join("examples", "stage-4", "35-skill-loader", "fixtures")).loadSync()) {
    registry.register(skill);
  }
  registry.register({
    name: "git-workflow",
    description: "遵循仓库约定的 Git 提交与分支规范时使用：小步提交、清晰信息、干净历史。",
    content: "# git-workflow\n\n小步提交，一条信息只讲一件事；提交信息用祈使句。\n\n## 流程\n1. 改一处，跑一次测试；\n2. 提交前 review 自己的 diff。",
    dir: ".skills/git-workflow",
    scripts: ["suggest-commit.mjs"],
    references: ["cheatsheet.md"],
  });

  const tools = new ToolRegistry();
  tools.register(createSkillTool(registry));

  console.log("\n=== 1. 目录注入：只放 name + description（渐进式披露，正文不进上下文） ===");
  console.log(renderSkillCatalog(registry.list()));

  console.log("=== 2. 组装后的 system prompt（体积可控） ===");
  const base = "你是一个简洁、直接的中文 Coding Agent。\n\n【先观察】\n- 动手前先看清现状。";
  console.log(injectSkillCatalog(base, renderSkillCatalog(registry.list())));

  console.log("\n=== 3. load_skill：按需加载正文与配套能力 ===");
  const r1 = await tools.execute({ id: "t1", name: "load_skill", arguments: { name: "debugging" } });
  const v1 = r1.value as { content: string; dir: string; scripts: string[]; references: string[]; cached: boolean };
  console.log(`  load_skill("debugging") → cached=${v1.cached} · 正文 ${v1.content.length} 字符 · dir=${v1.dir}`);
  console.log(`    scripts=${JSON.stringify(v1.scripts)} · references=${JSON.stringify(v1.references)}`);
  const refPath = path.join(v1.dir, "references", v1.references[0]);
  const refHead = readFileSync(refPath, "utf-8").split("\n").find((line) => line.trim() !== "") ?? "";
  console.log(`    references[0] 可读 → ${refHead.slice(0, 40)}…（read 工具按 dir 相对路径即可读到）`);

  console.log("\n=== 4. 重复加载走缓存 ===");
  const r2 = await tools.execute({ id: "t2", name: "load_skill", arguments: { name: "debugging" } });
  const v2 = r2.value as { cached: boolean; loaded: number };
  console.log(`  load_skill("debugging") 再调 → cached=${v2.cached} · loaded=${v2.loaded}（不重复计数）`);

  console.log("\n=== 5. 预算：最多 3 个，第 4 个被拒 ===");
  const r3 = await tools.execute({ id: "t3", name: "load_skill", arguments: { name: "refactor" } });
  const r4 = await tools.execute({ id: "t4", name: "load_skill", arguments: { name: "git-workflow" } });
  const r5 = await tools.execute({ id: "t5", name: "load_skill", arguments: { name: "internal-comms" } });
  console.log(`  refactor → ${r3.ok ? "ok" : r3.error}`);
  console.log(`  git-workflow → ${r4.ok ? "ok" : r4.error}`);
  console.log(`  internal-comms（第 4 个）→ ${r5.ok ? "ok" : "拒绝：" + r5.error}`);

  console.log("\n=== 6. 未知技能有清晰拒绝 ===");
  const r6 = await tools.execute({ id: "t6", name: "load_skill", arguments: { name: "nope" } });
  console.log(`  load_skill("nope") → ${r6.ok ? "ok" : r6.error}`);
}

main();