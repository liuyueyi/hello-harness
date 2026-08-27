import { AgentContext, assistantMessage, systemMessage, toolMessage, userMessage } from "@hello-harness/core";
import { createContextCapability } from "@hello-harness/coding";
import type { Capability, CodeRuntime } from "@hello-harness/code-runtime";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`断言失败：${message}`);
}

async function call<T>(capability: Capability, action: string, args: unknown): Promise<T> {
  return capability.actions[action]!(args) as Promise<T>;
}

async function main() {
  const context = new AgentContext([
    systemMessage("你是代码助手。回答时优先根据已有上下文验证结论。"),
    userMessage("认证接口偶发 401，请定位 checkAuth 的调用链。"),
    assistantMessage("我会先检查 auth.ts 中的 checkAuth，再追踪 API handler。"),
    toolMessage("read-auth", `auth.ts: export function checkAuth(user, role) { return user.role === role; }
debug trace: ${"module loader cache entry unchanged; ".repeat(30)}`),
    userMessage("不要改代码，只给我认证失败的排查建议。"),
    assistantMessage("该函数没有管理员继承规则，可能是认证失败的原因。"),
    toolMessage("test-auth", "FAIL auth.spec.ts: admin should pass user check; expected true, received false"),
  ]);

  // 本章的查询操作不访问 Runtime State；因此 demo 用一个最小假 runtime 即可。
  const runtime: CodeRuntime = {
    async execute() { return { ok: true, stdout: "", stderr: "", durationMs: 0 }; },
    async describe() { return { alive: false, variables: [] }; },
    async reset() {},
  };
  const capability = createContextCapability(context, { current: runtime });

  console.log("=== 49 · Context Search：排序、过滤和分页 ===\n");

  console.log("--- 精确函数名：短消息也能排在冗长 tool 输出之前 ---");
  const functionSearch = await call<{
    total: number;
    results: Array<{ index: number; role: string; score: number; matchedTerms: string[]; snippet: string }>;
  }>(capability, "search", { query: "checkAuth", limit: 3 });
  console.log(`命中 ${functionSearch.total} 条：`);
  for (const hit of functionSearch.results) {
    console.log(`  [${hit.index}] ${hit.role} · score=${hit.score} · terms=${hit.matchedTerms.join(", ")}`);
    console.log(`    ${hit.snippet}`);
  }
  assert(functionSearch.total >= 3, "checkAuth 应至少命中三条相关消息");
  assert(functionSearch.results[0]?.index === 2, "精确函数名应优先命中 assistant 消息");

  console.log("\n--- 角色过滤：只检索用户的约束，不让 tool 输出淹没它 ---");
  const userSearch = await call<{ total: number; results: Array<{ role: string; snippet: string }> }>(
    capability,
    "search",
    { query: "认证失败", roles: ["user"], limit: 5 },
  );
  console.log(`用户消息命中 ${userSearch.total} 条：${userSearch.results.map((hit) => hit.snippet).join(" | ")}`);
  assert(userSearch.total === 2, "认证失败应命中两条用户消息");
  assert(userSearch.results.every((hit) => hit.role === "user"), "roles 过滤必须生效");

  console.log("\n--- 分页：先拿一页，再用 offset 继续拿 ---");
  const firstPage = await call<{ total: number; offset: number; results: Array<{ index: number }> }>(
    capability,
    "search",
    { query: "auth", limit: 1 },
  );
  const secondPage = await call<{ total: number; offset: number; results: Array<{ index: number }> }>(
    capability,
    "search",
    { query: "auth", offset: 1, limit: 1 },
  );
  console.log(`总命中 ${firstPage.total}，第 1 页 [${firstPage.results[0]?.index}]，第 2 页 [${secondPage.results[0]?.index}]`);
  assert(firstPage.total === secondPage.total && firstPage.total >= 3, "分页前后 total 必须稳定");
  assert(firstPage.results[0]?.index !== secondPage.results[0]?.index, "offset 应跳过上一页结果");

  console.log("\n--- filter / slice：搜索后继续缩小和定位原始消息 ---");
  const tools = await call<{ total: number; messages: Array<{ index: number; role: string }> }>(
    capability,
    "filter",
    { roles: ["tool"] },
  );
  const recent = await call<{ total: number; messages: Array<{ index: number; role: string }> }>(
    capability,
    "slice",
    { start: -2 },
  );
  console.log(`tool 消息: ${tools.messages.map((message) => message.index).join(", ")}`);
  console.log(`最近两条: ${recent.messages.map((message) => `[${message.index}] ${message.role}`).join(", ")}`);
  assert(tools.total === 2, "应只保留两条 tool 消息");
  assert(recent.messages[0]?.index === 5 && recent.messages[1]?.index === 6, "slice 必须保留全局下标");

  console.log("\n✅ Context Search 演示通过");
  console.log("💡 本地 BM25 排序 + 精确短语加分；不上传对话，也不假装它是语义搜索。");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
