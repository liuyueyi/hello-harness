import OpenAI from "openai";
import type { Message } from "./messages";
import { systemMessage, userMessage } from "./messages";
import type { ModelEvent } from "./events";

function getApiKey(): string {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error("缺少 OPENAI_API_KEY：请复制 .env.example 为 .env 后填入真实 Key");
    process.exit(1);
  }
  return apiKey;
}

const client = new OpenAI({
  apiKey: getApiKey(),
  baseURL: process.env.OPENAI_BASE_URL,
});

const model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";

async function* streamChat(messages: Message[]): AsyncIterable<ModelEvent> {
  const stream = await client.chat.completions.create({
    model,
    messages: messages.map((m) => ({
      role: m.role,
      content: m.content,
    })),
    stream: true,
    stream_options: { include_usage: true },
  });

  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta?.content;
    if (delta) {
      yield { type: "content", text: delta };
    }
    if (chunk.usage) {
      yield {
        type: "usage",
        inputTokens: chunk.usage.prompt_tokens,
        outputTokens: chunk.usage.completion_tokens,
      };
    }
  }
}

async function main() {
  const question = process.argv[2] ?? "用一句话介绍你自己";
  const history: Message[] = [
    systemMessage("你是一个简洁、直接的中文助手。"),
    userMessage(question),
  ];

  const startedAt = Date.now();
  let firstTokenAt: number | undefined;
  let inputTokens = 0;
  let outputTokens = 0;

  process.stdout.write("Output : ");
  for await (const event of streamChat(history)) {
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
  console.log(`Model  : ${model} · ${elapsedMs}ms（首 token ${firstTokenMs}ms）· ${inputTokens} in / ${outputTokens} out`);
}

main().catch((error) => {
  console.error("调用失败：", error instanceof Error ? error.message : String(error));
  process.exit(1);
});