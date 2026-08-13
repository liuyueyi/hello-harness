import OpenAI from "openai";

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

async function main() {
  const input = process.argv[2] ?? "用一句话介绍你自己";
  const model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";

  console.log("Input :", input);

  const startedAt = Date.now();
  const completion = await client.chat.completions.create({
    model,
    messages: [
      { role: "system", content: "你是一个简洁、直接的中文助手。" },
      { role: "user", content: input },
    ],
  });
  const elapsedMs = Date.now() - startedAt;

  const output = completion.choices[0]?.message.content ?? "";
  console.log("Output:", output.trim());

  const usage = completion.usage;
  if (usage) {
    console.log(`Model : ${model} · ${elapsedMs}ms · ${usage.prompt_tokens} in / ${usage.completion_tokens} out`);
  } else {
    console.log(`Model : ${model} · ${elapsedMs}ms`);
  }
}

main().catch((error) => {
  console.error("调用失败：", error instanceof Error ? error.message : String(error));
  process.exit(1);
});