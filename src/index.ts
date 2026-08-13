import OpenAI from "openai";
import type { Message, AssistantMessage } from "./messages";
import { systemMessage, userMessage, assistantMessage } from "./messages";

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

async function chat(messages: Message[]): Promise<AssistantMessage> {
  const completion = await client.chat.completions.create({
    model,
    messages: messages.map((m) => ({
      role: m.role,
      content: m.content,
    })),
  });
  const content = completion.choices[0]?.message.content ?? "";
  return assistantMessage(content);
}

async function main() {
  const firstQuestion = process.argv[2] ?? "用一句话介绍你自己";

  const history: Message[] = [
    systemMessage("你是一个简洁、直接的中文助手。"),
  ];

  const questions = [firstQuestion, "把上一句概括成不超过 5 个字"];

  for (const question of questions) {
    history.push(userMessage(question));

    const startedAt = Date.now();
    const reply = await chat(history);
    const elapsedMs = Date.now() - startedAt;

    console.log("User   :", question);
    console.log("Output :", reply.content.trim());
    console.log(`Model  : ${model} · ${elapsedMs}ms`);
    console.log("");

    history.push(reply);
  }

  console.log("--- 完整对话历史 ---");
  for (const message of history) {
    console.log(`[${message.role}] ${message.content}`);
  }
}

main().catch((error) => {
  console.error("调用失败：", error instanceof Error ? error.message : String(error));
  process.exit(1);
});