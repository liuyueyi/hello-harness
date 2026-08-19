import type { Tool, ToolResult } from "@hello-harness/core";

export const MAX_FETCH_CHARS = 8000;

export interface FetchUrlInput {
  url?: unknown;
}

export function createFetchUrlTool(options: { timeoutMs?: number } = {}): Tool {
  const timeoutMs = options.timeoutMs ?? 8000;

  return {
    name: "fetch_url",
    description: "HTTP GET 抓取一个 URL 的文本内容，返回状态码与正文（超长截断）；只支持 http / https",
    parameters: {
      type: "object",
      properties: {
        url: {
          type: "string",
          description: "要抓取的完整 URL，例如 https://example.com",
        },
      },
      required: ["url"],
    },
    async execute(input: unknown): Promise<ToolResult> {
      const { url } = input as FetchUrlInput;
      if (typeof url !== "string" || url.trim() === "") {
        return { ok: false, error: "参数 url 必须是字符串", kind: "tool", retryable: false };
      }

      let parsed: URL;
      try {
        parsed = new URL(url);
      } catch {
        return { ok: false, error: `URL 解析失败：${url}`, kind: "tool", retryable: false };
      }
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        return { ok: false, error: `仅支持 http / https，收到：${parsed.protocol}`, kind: "tool", retryable: false };
      }

      try {
        const response = await fetch(parsed, { signal: AbortSignal.timeout(timeoutMs) });
        const body = await response.text();
        const truncated =
          body.length > MAX_FETCH_CHARS
            ? `${body.slice(0, MAX_FETCH_CHARS)}\n...（已截断：正文共 ${body.length} 字符）`
            : body;
        return { ok: true, value: { url: parsed.href, status: response.status, body: truncated } };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { ok: false, error: `抓取失败：${message}`, kind: "tool", retryable: true };
      }
    },
  };
}
