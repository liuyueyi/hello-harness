import { createOpenAIModel } from "./model/openai";
import { systemMessage, userMessage } from "./messages";
import { calculator } from "./tool/calculator";
import { runAgent } from "./agent";
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

async function runAgentDemo(model: Model, request: ModelRequest) {
  const startedAt = Date.now();
  const { answer, history, iterations } = await runAgent(model, request, tools);
  const elapsedMs = Date.now() - startedAt;

  for (const m of history) {
    if (m.role === "assistant" && m.toolCalls && m.toolCalls.length > 0) {
      for (const call of m.toolCalls) {
        console.log(`ToolCall : ${call.name}(${JSON.stringify(call.arguments)})`);
      }
    } else if (m.role === "tool") {
      console.log(`Result  : ${m.content}`);
    }
  }
  console.log(`Answer  : ${answer}`);
  console.log(`Steps   : ${iterations} 轮 · ${history.length} 条消息 · ${elapsedMs}ms`);
}




async function main() {
  const args = process.argv.slice(2);
  const flags = args.filter((a) => a.startsWith("--"));
  const fullMode = flags.includes("--full");
  const toolsMode = flags.includes("--tools");
  const question = args.find((a) => !a.startsWith("--"));
  const prompt = question ?? "用一句话介绍你自己";

  const request: ModelRequest = {
    messages: [systemMessage("你是一个简洁、直接的中文助手，工具可以使用时必须调用工具；对于复杂的数学计算，你应该拆分成多个简单的表达式，进行多次的工具调用"), userMessage(prompt)],
  };

  const model = createOpenAIModel();
  if (toolsMode) {
    await runAgentDemo(model, request);
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