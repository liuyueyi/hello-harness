import { tmpdir } from "node:os";
import { join } from "node:path";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { Workspace } from "@hello-harness/coding";
import { JavaScriptRuntime, PythonRuntime, type RuntimeLanguage } from "@hello-harness/code-runtime";
import { createCodingCapabilities } from "@hello-harness/coding";

async function runCell(label: string, runtime: { execute(code: string): Promise<any> }, code: string): Promise<void> {
  const result = await runtime.execute(code);
  if (!result.ok) {
    console.log(`  ${label} → failed · ${result.error} · ${result.durationMs}ms`);
    if (result.stdout) console.log(`    stdout: ${result.stdout}`);
    if (result.stderr) console.log(`    stderr: ${result.stderr}`);
    return;
  }
  console.log(`  ${label} → completed · value=${JSON.stringify(result.value)} · ${result.durationMs}ms`);
  if (result.stdout) console.log(`    stdout: ${result.stdout}`);
}

async function main() {
  const tmpDir = await mkdtemp(join(tmpdir(), "harness-persist-"));
  const workspace = new Workspace(tmpDir);
  await workspace.write("data.csv", "name,score\nAlice,90\nBob,75\nCarol,88\n");

  const capabilities = createCodingCapabilities(workspace);
  const pyRuntime = new PythonRuntime({ timeoutMs: 5_000, capabilities });
  const jsRuntime = new JavaScriptRuntime({ language: "typescript", timeoutMs: 5_000, capabilities });

  console.log("=== 46 · Persistent Runtime：常驻内核演示 ===");
  console.log(`Workspace: ${tmpDir}\n`);

  // --- Python：跨单元格保留状态（数据经 Capability 载入内核全局） ---
  console.log("--- Python：跨单元格累积状态（持久内核） ---");
  await runCell("Py step 1", pyRuntime, `
    # 通过 Capability 读工作区文件（工作区相对路径），结果沉淀到内核全局变量 rows
    content = fs.read("data.csv")
    lines = content.strip().split("\\n")[1:]
    rows = [{"name": n, "score": int(s)} for n, s in (line.split(",") for line in lines)]
    print("已载入", len(rows), "行")
  `);
  // 同一个内核进程，rows 仍然在
  await runCell("Py step 2", pyRuntime, `
    avg = sum(r["score"] for r in rows) / len(rows)
    top = max(rows, key=lambda r: r["score"])["name"]
    return {"avg": avg, "top": top}
  `);

  // --- Python：从 Capability 读入并在内核中沉淀 ---
  console.log("\n--- Python：Capability 结果沉淀到内核全局 ---");
  await runCell("Py cap read", pyRuntime, `
    content = fs.read("data.csv")
    lines = content.strip().split("\\n")[1:]
    total = len(lines)
    return {"rows": total}
  `);
  await runCell("Py reuse total", pyRuntime, `
    # total 来自上一次单元格，内核未重启
    return {"reused_total": total}
  `);

  // --- JS：裸赋值跨单元格保留 ---
  console.log("\n--- JavaScript：裸赋值跨单元格保留 ---");
  await runCell("JS seed", jsRuntime, `
    count = 0
    return count
  `);
  await runCell("JS increment", jsRuntime, `
    count += 3
    return count
  `);
  await runCell("JS increment again", jsRuntime, `
    count += 1
    return count
  `);

  // --- reset 清空内核 ---
  console.log("\n--- reset 清空内核 ---");
  await pyRuntime.reset();
  await runCell("Py after reset", pyRuntime, `
    return {"rows_still_here": "rows" in globals()}
  `);
  await jsRuntime.reset();
  await runCell("JS after reset", jsRuntime, `
    return typeof count
  `);

  // --- 用一次性内核验证 reset 后干净重启 ---
  console.log("\n--- reset 后可重新从空白内核起步 ---");
  await runCell("Py fresh", pyRuntime, `
    fresh = 42
    return fresh
  `);

  await rm(tmpDir, { recursive: true, force: true });
  await pyRuntime.reset();
  await jsRuntime.reset();
  console.log("\n✅ 所有测试完成，临时目录已清理");
}

main().catch((e) => {
  console.error("Demo 失败:", e);
  process.exit(1);
});
