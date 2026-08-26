import { tmpdir } from "node:os";
import { join } from "node:path";
import { mkdtemp, rm } from "node:fs/promises";
import { Workspace } from "@hello-harness/coding";
import { JavaScriptRuntime, PythonRuntime, createCodeRuntime, type RuntimeLanguage } from "@hello-harness/code-runtime";
import { createCodingCapabilities } from "@hello-harness/coding";

async function runCodeAction(label: string, runtime: any, code: string): Promise<void> {
  const result = await runtime.execute(code);
  if (!result.ok) {
    console.log(`  ${label} → failed · ${result.error} · ${result.durationMs}ms`);
    if (result.stdout) console.log(`    stdout: ${result.stdout}`);
    if (result.stderr) console.log(`    stderr: ${result.stderr}`);
    return;
  }
  console.log(`  ${label} → completed · value=${JSON.stringify(result.value)} · ${result.durationMs}ms`);
  if (result.stdout) console.log(`    stdout: ${result.stdout}`);
  if (result.stderr) console.log(`    stderr: ${result.stderr}`);
}

async function main() {
  // Create a temporary workspace directory
  const tmpDir = await mkdtemp(join(tmpdir(), "harness-cap-"));
  const workspace = new Workspace(tmpDir);

  // Pre-populate with a sample file
  await workspace.write("sample.txt", "Hello from workspace!");
  await workspace.write("notes.md", "# Notes\n\nThis is a test file.");

  // Create capabilities
  const capabilities = createCodingCapabilities(workspace);

  // Create runtimes with capabilities
  const jsRuntime = new JavaScriptRuntime({ language: "typescript", timeoutMs: 5_000, capabilities });
  const pyRuntime = new PythonRuntime({ timeoutMs: 5_000, capabilities });

  console.log("=== 45 · Capability Runtime：fs + shell 注入演示 ===");
  console.log(`Workspace: ${tmpDir}`);
  console.log("");

  // Test 1: fs.read via TypeScript
  console.log("--- Test 1: fs.read (TypeScript) ---");
  await runCodeAction("JS fs.read", jsRuntime, `
    const content = await fs.read("sample.txt");
    console.log("读到内容:", content);
    return { file: "sample.txt", length: content.length };
  `);

  // Test 2: fs.read via Python
  console.log("\n--- Test 2: fs.read (Python) ---");
  await runCodeAction("Py fs.read", pyRuntime, `
    content = fs.read("sample.txt")
    print("读到内容:", content)
    return {"file": "sample.txt", "length": len(content)}
  `);

  // Test 3: fs.write + fs.read roundtrip via TypeScript
  console.log("\n--- Test 3: fs.write + fs.read (TypeScript) ---");
  await runCodeAction("JS write+read", jsRuntime, `
    await fs.write({ path: "newfile.txt", content: "Written from JS Runtime" });
    const back = await fs.read("newfile.txt");
    console.log("回读:", back);
    return { written: true, content: back };
  `);

  // Test 4: fs.write + fs.read roundtrip via Python
  console.log("\n--- Test 4: fs.write + fs.read (Python) ---");
  await runCodeAction("Py write+read", pyRuntime, `
    fs.write({"path": "pyfile.txt", "content": "Written from Python Runtime"})
    back = fs.read("pyfile.txt")
    print("回读:", back)
    return {"written": True, "content": back}
  `);

  // Test 5: fs.list via TypeScript
  console.log("\n--- Test 5: fs.list (TypeScript) ---");
  await runCodeAction("JS fs.list", jsRuntime, `
    const entries = await fs.list(".");
    console.log("目录条目:", entries.map(e => e.name).join(", "));
    return { count: entries.length, names: entries.map(e => e.name) };
  `);

  // Test 6: fs.list via Python
  console.log("\n--- Test 6: fs.list (Python) ---");
  await runCodeAction("Py fs.list", pyRuntime, `
    entries = fs.list(".")
    print("目录条目:", ", ".join([e["name"] for e in entries]))
    return {"count": len(entries), "names": [e["name"] for e in entries]}
  `);

  // Test 7: shell.run via TypeScript
  console.log("\n--- Test 7: shell.run (TypeScript) ---");
  await runCodeAction("JS shell.run", jsRuntime, `
    const result = await shell.run("echo Hello from JS Runtime");
    console.log("stdout:", result.stdout.trim());
    return { exitCode: result.exitCode, stdout: result.stdout.trim() };
  `);

  // Test 8: shell.run via Python
  console.log("\n--- Test 8: shell.run (Python) ---");
  await runCodeAction("Py shell.run", pyRuntime, `
    result = shell.run("echo Hello from Python Runtime")
    print("stdout:", result["stdout"].strip())
    return {"exitCode": result["exitCode"], "stdout": result["stdout"].strip()}
  `);

  // Test 9: Path containment - should fail
  console.log("\n--- Test 9: Path containment (越界读取应被拒绝) ---");
  await runCodeAction("JS fs.read 越界", jsRuntime, `
    try {
      await fs.read("../package.json");
      return { ok: true };
    } catch (e) {
      console.log("预期被拒绝:", e.message);
      return { ok: false, error: e.message };
    }
  `);

  // Test 10: Path containment via Python
  console.log("\n--- Test 10: Path containment (Python 越界) ---");
  await runCodeAction("Py fs.read 越界", pyRuntime, `
    try:
      fs.read("../package.json")
      return {"ok": True}
    except Exception as e:
      print("预期被拒绝:", str(e))
      return {"ok": False, "error": str(e)}
  `);

  // Cleanup
  await rm(tmpDir, { recursive: true, force: true });
  // 第 46 章之后 Python 运行时是常驻内核，演示结束需显式 reset 以退出子进程。
  await jsRuntime.reset();
  await pyRuntime.reset();
  console.log("\n✅ 所有测试完成，临时目录已清理");
}

main().catch(e => {
  console.error("Demo 失败:", e);
  process.exit(1);
});