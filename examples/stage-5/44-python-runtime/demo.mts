import { createOpenAIModel } from "@hello-harness/ai";
import { systemMessage, userMessage } from "@hello-harness/core";
import { PythonRuntime, type RuntimeLanguage } from "@hello-harness/code-runtime";

function extractCode(content: string): string {
  const trimmed = content.trim();
  const fenced = trimmed.match(/^```(?:python|py)?\s*\n([\s\S]*?)\n```$/i);
  return (fenced?.[1] ?? trimmed).trim();
}

async function runCodeAction(runtime: PythonRuntime, label: string, code: string): Promise<void> {
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

const computeCode = [
  "services = [",
  '    {"name": "api", "timeout_ms": 3000},',
  '    {"name": "worker", "timeout_ms": 5000},',
  '    {"name": "db", "timeout_ms": 2000},',
  "]",
  "total = sum(s['timeout_ms'] for s in services)",
  "average = total / len(services)",
  "print({'services': [s['name'] for s in services], 'average': average})",
  "return {'count': len(services), 'average': average}",
].join("\n");

const exceptionCode = "raise ValueError('故意抛错：演示失败如何收敛成 RuntimeResult')";

const timeoutCode = "while True:\n    pass";

const runtime = new PythonRuntime({ timeoutMs: 1_000 });
const fastRuntime = new PythonRuntime({ timeoutMs: 500 });

console.log("=== 44 · PythonRuntime：Python 子进程参考实现 ===");
console.log("公共契约        : execute(code) → RuntimeResult；reset()");
console.log("执行环境        : 独立 Python 解释器（一次执行一次退出）；宿主把代码包进 __hr_main__() 以便用 return 回传值");

console.log("\nPython Code Action（return 字典）：");
await runCodeAction(runtime, "python", computeCode);

console.log("\n抛出异常被翻译为 RuntimeFailure：");
await runCodeAction(runtime, "python", exceptionCode);

console.log("\n同步死循环被 SIGKILL 收束：");
await runCodeAction(fastRuntime, "while True", timeoutCode);

console.log("\nreset() 对当前一次性子进程是显式 no-op：");
await runtime.reset();
console.log("  reset 完成；第 46 章的 Persistent Runtime 会把它变成真正的状态清理入口。");

console.log("\n注意：Python 子进程比 node vm 多一层进程隔离，但仍不是安全沙箱——它看得见本机文件与网络。Capability 注入留给第 45 章。");

if (process.argv.includes("--live")) {
  const model = createOpenAIModel();
  const response = await model.generate({
    messages: [
      systemMessage(`你是一个 Python Code Action 生成器。只输出可直接执行的 Python 代码，不要 Markdown 代码围栏、解释、import 或 export。
运行环境只有 print 和标准内存计算能力；没有 process、文件、网络或外部 Capability。
代码必须：
1. 在内存中声明至少 4 条 {"service": str, "timeout_ms": int} 数据；
2. 用列表方法按 service 聚合并计算平均 timeout；
3. print 一行 JSON 摘要；
4. return 一个包含服务数和全局平均值的字典。`),
      userMessage("请生成用于 timeout 审计的 Python Code Action。"),
    ],
  });

  const code = extractCode(response.content);
  const result = await runtime.execute(code);

  console.log("\n=== 44 · 真实模型生成并执行 Python Code Action ===");
  console.log(`Model  : ${model.modelName} · ${response.inputTokens} in / ${response.outputTokens} out`);
  console.log("\n模型生成的代码：");
  console.log(code || "（模型没有返回文本）");
  console.log("\nRuntimeResult：");
  console.log(JSON.stringify(result, null, 2));
} else if (process.argv.length > 2) {
  console.log("\n（提示：加上 --live 可让真实模型生成 Python Code Action 并执行，需先配置 .env）");
}
