import { JavaScriptRuntime } from "@hello-harness/code-runtime";
import type { CodeRuntime } from "@hello-harness/code-runtime";

async function runCodeAction(runtime: CodeRuntime, label: string, code: string): Promise<void> {
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

const typescriptRuntime = new JavaScriptRuntime({ language: "typescript", timeoutMs: 50 });
const javascriptRuntime = new JavaScriptRuntime({ language: "javascript", timeoutMs: 50 });

const typescriptCode = [
  "type Timeout = { service: string; ms: number };",
  "const values: Timeout[] = [{ service: 'api', ms: 3000 }, { service: 'worker', ms: 5000 }];",
  "const average = values.reduce((sum, item) => sum + item.ms, 0) / values.length;",
  "console.log({ services: values.map((item) => item.service), average });",
  "return { count: values.length, average };",
].join("\n");

const javascriptCode = [
  "const names = ['read', 'search', 'write'];",
  "const surface = { hasProcess: typeof process !== 'undefined', hasRequire: typeof require !== 'undefined' };",
  "console.warn('这段代码只看见 console，不看见 process 或 require');",
  "return { actions: names.map((name) => name.toUpperCase()), ...surface };",
].join("\n");

console.log("=== 43 · CodeRuntime：JavaScript / TypeScript 参考实现 ===");
console.log("公共契约        : execute(code) → RuntimeResult；reset()");
console.log("执行环境        : Node vm + 最小 console（不注入 process / require / 文件 / 网络）");

console.log("\nTypeScript Code Action：");
await runCodeAction(typescriptRuntime, "typescript", typescriptCode);

console.log("\nJavaScript Code Action：");
await runCodeAction(javascriptRuntime, "javascript", javascriptCode);

console.log("\n同步死循环被 vm timeout 收束：");
await runCodeAction(javascriptRuntime, "while (true) {}", "while (true) {}");

console.log("\nreset() 对当前无状态 Runtime 是显式 no-op：");
await typescriptRuntime.reset();
console.log("  reset 完成；第 46 章的 Persistent Runtime 会把它变成真正的状态清理入口。");

console.log("\n注意：node:vm 不是安全沙箱；这是教学参考实现，不能执行不可信生产代码。Capability 注入留给第 45 章。");
