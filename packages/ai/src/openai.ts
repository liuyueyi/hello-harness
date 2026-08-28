import OpenAI from "openai";
import type { ChatCompletionMessageParam, ChatCompletionTool } from "openai/resources/chat/completions";
import type { Message } from "@hello-harness/core";
import type { ModelEvent } from "@hello-harness/core";
import type { Model } from "@hello-harness/core";
import type { ModelRequest, ModelResponse, ToolCall, ToolDefinition } from "@hello-harness/core";

function toWireMessages(messages: Message[]): ChatCompletionMessageParam[] {
  return messages.map((m): ChatCompletionMessageParam => {
    switch (m.role) {
      case "assistant":
        return {
          role: "assistant",
          content: m.content,
          tool_calls: m.toolCalls?.map((call) => ({
            id: call.id,
            type: "function",
            function: { name: call.name, arguments: JSON.stringify(call.arguments) },
          })),
        };
      case "tool":
        return { role: "tool", tool_call_id: m.toolCallId, content: m.content };
      default:
        return { role: m.role, content: m.content };
    }
  });
}

function toWireTools(tools: ToolDefinition[]): ChatCompletionTool[] {
  return tools.map((tool) => ({
    type: "function",
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters as Record<string, unknown>,
    },
  }));
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
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
      tools: request.tools ? toWireTools(request.tools) : undefined,
    });

    const message = completion.choices[0]?.message;
    const messageToolCalls = (message?.tool_calls ?? []).filter((call) => call.type === "function");
    // 部分 OpenAI 兼容端点会把工具调用以文本形式回显到 content；
    // 一旦存在真正的 tool_calls，就丢弃 content，避免把 JSON 当作回答渲染出来。
    return {
      content: messageToolCalls.length > 0 ? "" : message?.content ?? "",
      toolCalls: messageToolCalls.map((call): ToolCall => ({
        id: call.id,
        name: call.function.name,
        arguments: parseJson(call.function.arguments),
      })),
      inputTokens: completion.usage?.prompt_tokens ?? 0,
      outputTokens: completion.usage?.completion_tokens ?? 0,
    };
  }

  async *stream(request: ModelRequest): AsyncIterable<ModelEvent> {
    const stream = await this.client.chat.completions.create({
      model: this.modelName,
      messages: toWireMessages(request.messages),
      tools: request.tools ? toWireTools(request.tools) : undefined,
      stream: true,
      stream_options: { include_usage: true },
    });

    let toolSeen = false;
    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta;
      if (delta?.tool_calls && delta.tool_calls.length > 0) toolSeen = true;
      // 工具调用出现后，部分端点会把调用 JSON 回显进 content；
      // 此时丢弃后续 content，避免把 JSON 当作回答渲染成大片空白。
      if (delta?.content && !toolSeen) {
        yield { type: "content", text: delta.content };
      }
      const raw = (delta ?? {}) as Record<string, unknown>;
      const reasoning =
        (typeof raw.reasoning === "string" && raw.reasoning) ||
        (typeof raw.reasoning_content === "string" && raw.reasoning_content);
      if (reasoning) {
        yield { type: "reasoning", text: reasoning };
      }
      for (const call of delta?.tool_calls ?? []) {
        yield {
          type: "tool_call",
          index: call.index,
          id: call.id,
          name: call.function?.name,
          arguments: call.function?.arguments ?? "",
        };
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