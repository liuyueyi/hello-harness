import { createOpenAIModel } from "./model/openai";
import { systemMessage, userMessage } from "./messages";
import { calculator } from "./tool/calculator";
import type { Model } from "./model/model";
import type { ModelRequest } from "./model/types";
import type { Tool } from "./tool/tool";

const tools: Record<string, Tool> = {
  calculator,
};

async function runStream(model: Model, request: ModelRequest) {
  const startedAt = Date.now();
  let firstTokenAt: number | undefined;
  let inputTokens = 0;
  let outputTokens = 0;

  process.stdout.write("Output : ");
  for await (const event of model.stream(request)) {
    if (event.type === "content") {
      if (firstTokenAt === undefined) firstTokenAt = Date.now();
      process.stdout.write(event.text);
    } else if (event.type === "usage") {
      inputTokens = event.inputTokens;
      outputTokens = event.outputTokens;
    }
  }

  const elapsedMs = Date.now() - startedAt;
  const firstTokenMs = firstTokenAt === undefined ? 0 : firstTokenAt - startedAt;
  console.log("");
  console.log(`Model  : ${model.modelName} · ${elapsedMs}ms（首 token ${firstTokenMs}ms）· ${inputTokens} in / ${outputTokens} out`);
}

async function runGenerate(model: Model, request: ModelRequest) {
  const startedAt = Date.now();
  const response = await model.generate(request);
  const elapsedMs = Date.now() - startedAt;

  console.log(`Output : ${response.content}`);
  console.log(`Model  : ${model.modelName} · ${elapsedMs}ms（一次性）· ${response.inputTokens} in / ${response.outputTokens} out`);
}

async function runToolCall(model: Model, request: ModelRequest) {
  const startedAt = Date.now();
  const response = await model.generate({ ...request, tools: Object.values(tools) });
  const elapsedMs = Date.now() - startedAt;

  if (response.toolCalls.length > 0) {
    console.log("ToolCall :");
    for (const call of response.toolCalls) {
      console.log(`  ${call.name}(${JSON.stringify(call.arguments)})`);
      const tool = tools[call.name];
      if (!tool) {
        console.log("    → 未知工具，无法执行");
        continue;
      }
      const result = await tool.execute(call.arguments);
      console.log(`Result  : ${JSON.stringify(result)}`);
    }
  } else {
    console.log(`Output : ${response.content}`);
  }
  console.log(`Model  : ${model.modelName} · ${elapsedMs}ms · ${response.inputTokens} in / ${response.outputTokens} out`);
}

async function main() {
  const args = process.argv.slice(2);
  const flags = args.filter((a) => a.startsWith("--"));
  const fullMode = flags.includes("--full");
  const toolsMode = flags.includes("--tools");
  const question = args.find((a) => !a.startsWith("--"));
  const prompt = question ?? "用一句话介绍你自己";

  const request: ModelRequest = {
    messages: [systemMessage("你是一个简洁、直接的中文助手。"), userMessage(prompt)],
  };

  const model = createOpenAIModel();
  if (toolsMode) {
    await runToolCall(model, request);
  } else if (fullMode) {
    await runGenerate(model, request);
  } else {
    await runStream(model, request);
  }
}

main().catch((error) => {
  console.error("调用失败：", error instanceof Error ? error.message : String(error));
  process.exit(1);
});