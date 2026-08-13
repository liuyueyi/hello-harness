import OpenAI from "openai";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import type { Message } from "../messages";
import type { ModelEvent } from "../events";
import type { Model } from "./model";
import type { ModelRequest, ModelResponse } from "./types";

function toWireMessages(messages: Message[]): ChatCompletionMessageParam[] {
  return messages.map((m) => ({ role: m.role, content: m.content }));
}

export class OpenAIModel implements Model {
  readonly modelName: string;

  constructor(
    private readonly client: OpenAI,
    modelName: string,
  ) {
    this.modelName = modelName;
  }

  async generate(request: ModelRequest): Promise<ModelResponse> {
    const completion = await this.client.chat.completions.create({
      model: this.modelName,
      messages: toWireMessages(request.messages),
    });

    return {
      content: completion.choices[0]?.message?.content ?? "",
      inputTokens: completion.usage?.prompt_tokens ?? 0,
      outputTokens: completion.usage?.completion_tokens ?? 0,
    };
  }

  async *stream(request: ModelRequest): AsyncIterable<ModelEvent> {
    const stream = await this.client.chat.completions.create({
      model: this.modelName,
      messages: toWireMessages(request.messages),
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
}

export function createOpenAIModel(): Model {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("缺少 OPENAI_API_KEY：请复制 .env.example 为 .env 后填入真实 Key");
  }

  const client = new OpenAI({
    apiKey,
    baseURL: process.env.OPENAI_BASE_URL,
  });

  return new OpenAIModel(client, process.env.OPENAI_MODEL ?? "gpt-4o-mini");
}