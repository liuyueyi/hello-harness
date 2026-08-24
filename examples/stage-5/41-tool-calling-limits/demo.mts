import {
  AgentRuntime,
  ToolRegistry,
  userMessage,
  type Model,
  type ModelRequest,
  type ModelResponse,
  type Tool,
  type ToolResult,
} from "@hello-harness/core";

interface DemoToolOptions {
  name: string;
  description: string;
  properties?: Record<string, unknown>;
  required?: string[];
  run?: (input: unknown) => ToolResult;
}

function demoTool(options: DemoToolOptions): Tool {
  return {
    name: options.name,
    description: options.description,
    parameters: {
      type: "object",
      properties: options.properties ?? {},
      required: options.required ?? [],
      additionalProperties: false,
    },
    async execute(input: unknown): Promise<ToolResult> {
      return options.run?.(input) ?? { ok: true, value: `${options.name}: ok` };
    },
  };
}

const registry = new ToolRegistry();

for (const tool of [
  demoTool({
    name: "list_files",
    description: "列出 workspace 内匹配 glob 的文件；返回相对路径数组，不读取文件内容",
    properties: { glob: { type: "string", description: "glob 表达式，例如 src/**/*.ts" } },
    required: ["glob"],
    run: () => ({ ok: true, value: ["src/api.ts", "src/cache.ts", "src/index.ts"] }),
  }),
  demoTool({
    name: "read_file",
    description: "读取 workspace 内一个 UTF-8 文本文件；文件过长时按 maxChars 截断",
    properties: {
      path: { type: "string", description: "相对 workspace 根目录的文件路径" },
      maxChars: { type: "integer", description: "最多返回多少字符" },
    },
    required: ["path"],
    run: (input) => {
      const { path } = input as { path?: unknown };
      if (path === "src/missing.ts") {
        return { ok: false, error: "文件不存在：src/missing.ts", kind: "tool", retryable: false };
      }
      return { ok: true, value: "export const apiTimeout = 3000;\nexport const cacheTimeout = 5000;" };
    },
  }),
  demoTool({
    name: "search_text",
    description: "在 workspace 文本文件中搜索正则表达式；返回文件、行号和匹配行",
    properties: {
      pattern: { type: "string", description: "正则表达式" },
      glob: { type: "string", description: "限定文件范围的 glob" },
      maxResults: { type: "integer", description: "最大匹配数" },
    },
    required: ["pattern"],
    run: () => ({
      ok: true,
      value: Array.from({ length: 18 }, (_, index) => ({
        path: `src/module-${String(index + 1).padStart(2, "0")}.ts`,
        line: index + 10,
        text: `const timeout = ${3000 + index * 100}; // TODO: centralize timeout configuration`,
      })),
    }),
  }),
  demoTool({
    name: "write_file",
    description: "把完整 content 写入 workspace 文件；已有文件会被覆盖，父目录自动创建",
    properties: {
      path: { type: "string", description: "相对 workspace 根目录的目标路径" },
      content: { type: "string", description: "要写入的完整内容" },
    },
    required: ["path", "content"],
    run: (input) => {
      const { path, content } = input as { path?: unknown; content?: unknown };
      return { ok: true, value: { path, chars: typeof content === "string" ? content.length : 0 } };
    },
  }),
  demoTool({
    name: "edit_file",
    description: "对文件做一次精确 search/replace；oldText 必须只出现一次",
    properties: {
      path: { type: "string" },
      oldText: { type: "string" },
      newText: { type: "string" },
    },
    required: ["path", "oldText", "newText"],
  }),
  demoTool({
    name: "read_json",
    description: "读取 JSON 文件并解析为对象；解析失败时返回结构化错误",
    properties: { path: { type: "string" } },
    required: ["path"],
  }),
  demoTool({
    name: "write_json",
    description: "把对象序列化为格式化 JSON 并写入文件",
    properties: { path: { type: "string" }, value: { type: "object" } },
    required: ["path", "value"],
  }),
  demoTool({
    name: "run_shell",
    description: "在 workspace 根目录运行一条命令；返回 stdout、stderr 和退出码",
    properties: { command: { type: "string" }, timeoutMs: { type: "integer" } },
    required: ["command"],
  }),
  demoTool({
    name: "git_status",
    description: "读取当前 Git 工作区状态；不修改仓库",
  }),
  demoTool({
    name: "git_diff",
    description: "读取当前 Git diff；可按 path 限定范围，不修改仓库",
    properties: { path: { type: "string" } },
  }),
  demoTool({
    name: "fetch_url",
    description: "通过 HTTP GET 获取 URL 正文；仅允许 http/https，响应过长会截断",
    properties: { url: { type: "string" } },
    required: ["url"],
  }),
  demoTool({
    name: "query_database",
    description: "执行只读数据库查询；必须提供数据源和查询文本",
    properties: { source: { type: "string" }, query: { type: "string" } },
    required: ["source", "query"],
  }),
]) {
  registry.register(tool);
}

const replies: ModelResponse[] = [
  {
    content: "先找出源码文件。",
    toolCalls: [{ id: "c1", name: "list_files", arguments: { glob: "src/**/*.ts" } }],
    inputTokens: 100,
    outputTokens: 12,
  },
  {
    content: "先读入口文件。",
    toolCalls: [{ id: "c2", name: "read_file", arguments: { path: "src/missing.ts", maxChars: 4000 } }],
    inputTokens: 140,
    outputTokens: 14,
  },
  {
    content: "路径猜错了，改读真实入口。",
    toolCalls: [{ id: "c3", name: "read_file", arguments: { path: "src/index.ts", maxChars: 4000 } }],
    inputTokens: 180,
    outputTokens: 16,
  },
  {
    content: "再搜索所有 timeout 定义。",
    toolCalls: [
      { id: "c4", name: "search_text", arguments: { pattern: "timeout", glob: "src/**/*.ts", maxResults: 50 } },
    ],
    inputTokens: 220,
    outputTokens: 18,
  },
  {
    content: "整理结果并写报告。",
    toolCalls: [
      {
        id: "c5",
        name: "write_file",
        arguments: {
          path: "reports/timeouts.md",
          content: "# Timeout audit\n\n发现 18 处 timeout 定义；建议收敛为统一配置。\n",
        },
      },
    ],
    inputTokens: 420,
    outputTokens: 24,
  },
  {
    content: "审计完成：发现 18 处 timeout 定义，报告已写入 reports/timeouts.md。",
    toolCalls: [],
    inputTokens: 450,
    outputTokens: 28,
  },
];

const requests: Array<{ schemaChars: number; messageChars: number; toolMessages: number }> = [];
let replyIndex = 0;
const model: Model = {
  modelName: "scripted-tool-limit-demo",
  async generate(request: ModelRequest): Promise<ModelResponse> {
    requests.push({
      schemaChars: JSON.stringify(request.tools ?? []).length,
      messageChars: JSON.stringify(request.messages).length,
      toolMessages: request.messages.filter((message) => message.role === "tool").length,
    });
    const response = replies[replyIndex];
    replyIndex += 1;
    if (!response) throw new Error("脚本回复已耗尽");
    return response;
  },
  async *stream() {},
};

const runtime = new AgentRuntime(model, registry, { maxSteps: 10 });
const run = await runtime.run({
  messages: [userMessage("审计 src 中散落的 timeout 配置，把结论写到 reports/timeouts.md")],
});

const failedCalls = run.steps.filter((step) => step.type === "tool" && !step.result.ok).length;
const toolCalls = run.steps.filter((step) => step.type === "tool").length;
const schemaCharsPerRequest = requests[0]?.schemaChars ?? 0;
const totalSchemaChars = requests.reduce((sum, request) => sum + request.schemaChars, 0);

console.log("=== 41 · Tool Calling 的边界：一次组合任务的账单 ===");
console.log(`工具菜单        : ${registry.list().length} 个 Tool Schema`);
console.log(`模型往返        : ${requests.length} 次（${toolCalls} 次工具调用 + 1 次最终回答）`);
console.log(`失败调用        : ${failedCalls} 次（纠错占用了一次额外往返）`);
console.log(`单次 Schema     : ${schemaCharsPerRequest} 字符`);
console.log(`累计 Schema     : ${totalSchemaChars} 字符（同一份菜单重复发送 ${requests.length} 次）`);
console.log(`最终消息上下文  : ${requests.at(-1)?.messageChars ?? 0} 字符`);
console.log(`最终 Tool Result: ${requests.at(-1)?.toolMessages ?? 0} 条已经回灌 messages[]`);
console.log(`运行结果        : ${run.status} (${run.stopReason}) · ${run.answer}`);

console.log("\n每次模型调用看到的负担：");
requests.forEach((request, index) => {
  console.log(
    `  #${index + 1} schema=${request.schemaChars} chars · messages=${request.messageChars} chars · toolResults=${request.toolMessages}`,
  );
});

console.log("\n结论：Tool Calling 能完成任务；代价是 Harness 必须把菜单、编排轮次和中间结果都搬进模型上下文。");
