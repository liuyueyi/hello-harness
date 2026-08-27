import { tmpdir } from "node:os";
import { join } from "node:path";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { Workspace, createCodingCapabilities, createContextCapability } from "@hello-harness/coding";
import { createCodeActionTool, createCodeRuntime, type CodeRuntime, type RuntimeState } from "@hello-harness/code-runtime";

async function main() {
  const tmpDir = await mkdtemp(join(tmpdir(), "harness-ctx-var-"));
  const workspace = new Workspace(tmpDir);
  await workspace.write("auth.ts", `
export interface User { id: string; name: string; role: "admin" | "user"; }
export function checkAuth(user: User, requiredRole: "admin" | "user"): boolean {
  return user.role === requiredRole || user.role === "admin";
}
`);
  await workspace.write("api.ts", `
import { checkAuth } from "./auth";
export function handleRequest(user: User, action: string) {
  if (!checkAuth(user, "admin")) throw new Error("forbidden");
  return { ok: true, action };
}
`);

  const baseCapabilities = createCodingCapabilities(workspace);
  const codeRuntimeRef = { current: null as CodeRuntime | null };
  const codeRuntime = createCodeRuntime("python", { timeoutMs: 10_000, capabilities: baseCapabilities });
  codeRuntimeRef.current = codeRuntime;
  const contextCapability = createContextCapability(
    { messages: [] } as any, // 临时占位，实际由 Session 的 context 提供
    codeRuntimeRef,
  );
  const allCapabilities = [...baseCapabilities, contextCapability];

  // 重新创建带有完整 capabilities 的 runtime（内核尚未启动，会注入所有 capability）
  await codeRuntime.reset();
  const fullRuntime = createCodeRuntime("python", { timeoutMs: 10_000, capabilities: allCapabilities });
  codeRuntimeRef.current = fullRuntime;

  // 运行时状态缓存：由宿主在每次 execute 后更新，避免在单元格内调用 describe() 造成死锁
  let runtimeStateCache: RuntimeState = { alive: false, variables: [] };
  function updateRuntimeStateCache() {
    // 在单元格执行完毕、内核空闲时调用 describe() 更新缓存
    fullRuntime.describe().then(state => { runtimeStateCache = state; }).catch(() => {});
  }

  // 包装 execute 以自动更新缓存
  async function executeAndCache(code: string) {
    const result = await fullRuntime.execute(code);
    updateRuntimeStateCache();
    return result;
  }

  console.log("=== 48 · Context as Variable：Context 成为可编程变量 ===");
  console.log(`Workspace: ${tmpDir}\n`);

  // 1. context.search()、context.slice()、context.summarize() 不依赖 describe()，直接可用
  console.log("--- context.search() / slice() / summarize()：不依赖 Runtime State，直接可用 ---");
  const searchResult = await executeAndCache(`
results = context.search("auth")
print("搜索结果数:", results["total"])
for r in results["results"][:3]:
    print(f"  [{r['index']}] {r['role']}: {r['snippet'][:80]}")
  `);
  console.log(`  ok: ${searchResult.ok}, stdout: ${searchResult.stdout.trim()}`);

  const sliceResult = await executeAndCache(`
sliced = context.slice(0, 2)
print("前 2 条:", len(sliced["messages"]), "总条数:", sliced["total"])
  `);
  console.log(`  ok: ${sliceResult.ok}, stdout: ${sliceResult.stdout.trim()}`);

  const summaryResult = await executeAndCache(`
summary = context.summarize()
print("消息统计:", summary["messageCounts"])
print("总消息数:", summary["totalMessages"])
print("Runtime 变量数:", summary["runtimeVariables"])
print("Runtime 活着:", summary["runtimeAlive"])
  `);
  console.log(`  ok: ${summaryResult.ok}, stdout: ${summaryResult.stdout.trim()}`);

  // 2. 先在内核里攒变量，再通过 context.current() 看到它们
  // 注意：context.current() 内部会调用 getRuntimeState() -> describe()，在单元格内会死锁。
  // 正确用法：宿主在单元格间隙更新缓存，单元格内只用 search/slice/summarize。
  console.log("\n--- 先在内核里攒变量，宿主更新缓存后再查看 ---");
  await executeAndCache(`
content = fs.read("auth.ts")
lines = content.strip().split("\\n")
user_count = len([l for l in lines if "User" in l])
  `);
  // 此时缓存已更新，直接读取缓存展示（模拟 context.current() 的 runtimeState 部分）
  console.log(`  缓存中的 Runtime 变量: ${runtimeStateCache.variables.map(v => v.name).join(", ")}`);
  const userCountVar = runtimeStateCache.variables.find(v => v.name === "user_count");
  if (userCountVar) console.log(`  user_count 预览: ${userCountVar.preview}`);

  // 3. 组合使用：模型在 code_action 里用 search/slice 决策，再调用 fs/shell
  console.log("\n--- 组合使用：搜索上下文找到相关代码，再读文件验证 ---");
  const combined = await executeAndCache(`
found = context.search("checkAuth")
print("搜到 checkAuth:", found["total"], "次")
if found["total"] > 0:
    content = fs.read("auth.ts")
    print("文件内容前 200 字:", content[:200])
  `);
  console.log(`  ok: ${combined.ok}, stdout: ${combined.stdout.trim()}`);

  // 4. 搭配 code_action tool 演示（模拟模型调用）
  console.log("\n--- 通过 code_action tool 使用 context capability（模拟模型调用）---");
  const tool = createCodeActionTool("python", { runtime: fullRuntime, capabilities: allCapabilities });
  const obs = await tool.execute({
    code: `
# 模型在代码里主动查询上下文
found = context.search("api")
print("搜到 api:", found["total"], "次")
if found["total"] > 0:
    content = fs.read("api.ts")
    print("api.ts 前 150 字:", content[:150])
# 也可以用 slice 看最近几轮对话
recent = context.slice(-3, None)
print("最近对话条数:", len(recent["messages"]))
`
  });
  if (obs.ok) {
    const val = obs.value as { ok: boolean; stdout: string; state: RuntimeState };
    console.log(`  ok: ${val.ok}`);
    console.log(`  stdout: ${val.stdout.trim()}`);
    console.log(`  tool 返回的 state 变量: ${val.state.variables.map(v => v.name).join(", ")}`);
  }

  // 5. 宿主侧直接调用 describe()（单元格间隙，安全）
  console.log("\n--- 宿主侧直接调用 describe()（单元格间隙，安全）---");
  const hostDescribe = await fullRuntime.describe();
  console.log(`  alive: ${hostDescribe.alive}, variables: ${hostDescribe.variables.map(v => v.name).join(", ")}`);

  await rm(tmpDir, { recursive: true, force: true });
  await fullRuntime.reset();
  console.log("\n✅ 所有测试完成，临时目录已清理");
  console.log("\n💡 关键点总结：");
  console.log("  - context.search() / slice() / summarize()：纯在宿主侧运行，不依赖内核，单元格内可直接用");
  console.log("  - context.current() / getRuntimeState()：需要 describe()，在单元格内会死锁");
  console.log("  - 解决方案：宿主在每次 execute 后更新 runtimeState 缓存，单元格内读缓存");
  console.log("  - 这正是 code-chat 的做法：tool:end 事件里自动更新，模型通过 state 字段看到");
}

main().catch((e) => {
  console.error("Demo 失败:", e);
  process.exit(1);
});