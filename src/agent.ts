import type { Model } from "./model/model";
import type { ModelRequest } from "./model/types";
import type { Message } from "./messages";
import { assistantMessage, toolMessage } from "./messages";
import type { Tool } from "./tool/tool";

export interface AgentResult {
  answer: string;
  history: Message[];
  iterations: number;
}

export interface AgentOptions {
  maxIterations?: number;
}

export async function runAgent(
  model: Model,
  request: ModelRequest,
  tools: Record<string, Tool>,
  options: AgentOptions = {},
): Promise<AgentResult> {
  const maxIterations = options.maxIterations ?? 10;
  const history = [...request.messages];
  let iterations = 0;

  while (true) {
    iterations += 1;
    if (iterations > maxIterations) {
      throw new Error(`Agent 超过最大迭代次数（${maxIterations}），已强制停止`);
    }

    const response = await model.generate({
      messages: history,
      tools: Object.values(tools),
    });
    history.push(assistantMessage(response.content, response.toolCalls));

    if (response.toolCalls.length === 0) {
      return { answer: response.content, history, iterations };
    }

    for (const call of response.toolCalls) {
      const tool = tools[call.name];
      const result = tool ? await tool.execute(call.arguments) : { error: `未知工具：${call.name}` };
      history.push(toolMessage(call.id, JSON.stringify(result) ?? ""));
    }
  }
}