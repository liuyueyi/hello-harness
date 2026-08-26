import { tmpdir } from "node:os";
import { join } from "node:path";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { Workspace, createCodingCapabilities } from "@hello-harness/coding";
import { JavaScriptRuntime, PythonRuntime, createCodeActionTool, type RuntimeState } from "@hello-harness/code-runtime";

function printState(label: string, state: RuntimeState): void {
  const names = state.variables.map((v) => `${v.name}:${v.type}`).join(", ");
  console.log(`  ${label} → alive=${state.alive} · variables=[${names || "空"}]`);
  for (const v of state.variables) {
    console.log(`      ${v.name} (${v.type}) = ${v.preview}`);
  }
}

async function main() {
  const tmpDir = await mkdtemp(join(tmpdir(), "harness-state-"));
  const workspace = new Workspace(tmpDir);
  await workspace.write("data.csv", "name,score\nAlice,90\nBob,75\nCarol,88\n");

  const capabilities = createCodingCapabilities(workspace);
  const pyRuntime = new PythonRuntime({ timeoutMs: 5_000, capabilities });
  const jsRuntime = new JavaScriptRuntime({ language: "typescript", timeoutMs: 5_000, capabilities });

  console.log("=== 47 · Runtime State：Context = Conversation + Runtime State ===");
  console.log(`Workspace: ${tmpDir}\n`);

  // --- 内核还没启动：describe 不拉进程，直接报告「无内核」 ---
  console.log("--- 冷启动前：describe() 不会为了看状态而拉起内核 ---");
  printState("Py describe (before)", await pyRuntime.describe());
  printState("JS describe (before)", await jsRuntime.describe());

  // --- Python：单元格创建变量 → Runtime State 里看得见 ---
  console.log("\n--- Python：单元格攒下的变量进入 Runtime State ---");
  await pyRuntime.execute(`
    content = fs.read("data.csv")
    lines = content.strip().split("\\n")[1:]
    rows = [{"name": n, "score": int(s)} for n, s in (line.split(",") for line in lines)]

    def avg_score(data):
        return sum(r["score"] for r in data) / len(data)
  `);
  printState("Py describe", await pyRuntime.describe());

  // --- 对话很瘦，状态很厚：Context 是两者之和 ---
  console.log("\n--- Conversation 很瘦（只记答案），Runtime State 很厚（记着全部中间结果） ---");
  const conversation: string[] = [];
  const result1 = await pyRuntime.execute(`print("avg =", round(avg_score(rows), 2))`);
  conversation.push(`assistant#1: avg ≈ ${result1.ok ? "84.33" : "?"}`); // 模型回答只进了一句话
  const result2 = await pyRuntime.execute(`return {"top": max(rows, key=lambda r: r["score"])["name"]}`);
  conversation.push(`assistant#2: top = ${result2.ok ? JSON.stringify((result2 as { value?: unknown }).value) : "?"}`);
  console.log(`  Conversation: ${conversation.length} 条消息（模型上下文里的部分）:`);
  for (const m of conversation) console.log(`    ${m}`);
  console.log(`  Runtime State: ${JSON.stringify((await pyRuntime.describe()).variables.map((v) => v.name))}（内核替对话记着）`);

  // --- JavaScript：裸赋值进状态，let/const 不进（单元格局部） ---
  console.log("\n--- JavaScript：裸赋值可见，let/const 是单元格局部 ---");
  await jsRuntime.execute(`
    count = 41
    let hidden = "cell-local"
    globalThis.extra = "via-globalThis"
    return count
  `);
  printState("JS describe", await jsRuntime.describe());

  // --- 工具视角：code_action 的观察自带 state，随结果进入对话上下文 ---
  console.log("\n--- code_action 观察自带 state（Context = Conversation + Runtime State） ---");
  // 把上面同一个内核交给工具：观察里的 state 与 describe() 看到的是同一份状态。
  const tool = createCodeActionTool("python", { runtime: pyRuntime });
  const observation = await tool.execute({ code: `total = len(rows)\nreturn {"rows": total}` });
  if (observation.ok) {
    const value = observation.value as { ok: boolean; value: unknown; state: RuntimeState };
    console.log(`  value   = ${JSON.stringify(value.value)}`);
    console.log(`  state   = ${JSON.stringify(value.state.variables.map((v) => v.name))}  ← 这段随工具结果进入了对话`);
  }
  const observation2 = await tool.execute({ code: `return {"avg": round(avg_score(rows), 2)}` });
  if (observation2.ok) {
    const value = observation2.value as { ok: boolean; value: unknown; state: RuntimeState };
    console.log(`  value#2 = ${JSON.stringify(value.value)}`);
    printState("state#2", value.state);
  }

  // --- reset 之后：状态归零 ---
  console.log("\n--- reset：任务边界 = reset 边界 ---");
  await pyRuntime.reset();
  await jsRuntime.reset();
  printState("Py describe (after reset)", await pyRuntime.describe());
  printState("JS describe (after reset)", await jsRuntime.describe());

  await rm(tmpDir, { recursive: true, force: true });
  await pyRuntime.reset();
  await jsRuntime.reset();
  console.log("\n✅ 所有测试完成，临时目录已清理");
}

main().catch((e) => {
  console.error("Demo 失败:", e);
  process.exit(1);
});
