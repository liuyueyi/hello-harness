import { createOpenAIModel } from "@hello-harness/ai";
import { systemMessage, userMessage } from "@hello-harness/core";
import { JavaScriptRuntime } from "@hello-harness/code-runtime";

function extractCode(content: string): string {
  const trimmed = content.trim();
  const fenced = trimmed.match(/^```(?:typescript|ts|javascript|js)?\s*\n([\s\S]*?)\n```$/i);
  return (fenced?.[1] ?? trimmed).trim();
}

if (!process.argv.includes("--live")) {
  console.log("这是会调用真实模型的体验 demo。确认 .env 已配置后，运行：");
  console.log("  node --import tsx --env-file-if-exists=.env examples/stage-5/43-code-runtime/live-demo.mts --live");
  process.exit(0);
}

const model = createOpenAIModel();
const response = await model.generate({
  messages: [
    systemMessage(`你是一个 TypeScript Code Action 生成器。只输出可直接执行的 TypeScript 代码，不要 Markdown 代码围栏、解释、import 或 export。
运行环境只有 console.log / console.warn / console.error；没有 process、require、文件、网络或外部 Capability。
代码必须：
1. 在内存中声明至少 4 条 { service: string, timeoutMs: number } 数据；
2. 用数组方法按 service 聚合并计算平均 timeout；
3. console.log 一行 JSON 摘要；
4. return 一个包含服务数和全局平均值的对象。`),
    userMessage("请生成用于 timeout 审计的 TypeScript Code Action。"),
  ],
});

const code = extractCode(response.content);
const runtime = new JavaScriptRuntime({ language: "typescript", timeoutMs: 1_000 });
const result = await runtime.execute(code);

console.log("=== 43 · 真实模型生成并执行 TypeScript Code Action ===");
console.log(`Model  : ${model.modelName} · ${response.inputTokens} in / ${response.outputTokens} out`);
console.log("\n模型生成的代码：");
console.log(code || "（模型没有返回文本）");
console.log("\nRuntimeResult：");
console.log(JSON.stringify(result, null, 2));
