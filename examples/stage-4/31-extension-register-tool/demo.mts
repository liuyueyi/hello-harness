import { ExtensionRegistry, defineExtension } from "../../../src/extensions";
import { ToolRegistry } from "../../../src/core/tool/registry";
import type { Tool, ToolResult } from "../../../src/core/tool/tool";

const double: Tool = {
  name: "double",
  description: "把一个数字翻倍",
  parameters: {
    type: "object",
    properties: { n: { type: "number", description: "要翻倍的数字" } },
    required: ["n"],
  },
  async execute(input: unknown): Promise<ToolResult> {
    const { n } = input as { n?: unknown };
    if (typeof n !== "number") return { ok: false, error: "参数 n 必须是数字", kind: "tool", retryable: false };
    return { ok: true, value: n * 2 };
  },
};

async function main() {
  console.log("=== 31 · Extension 注册 Tool：把工具搬出门外 ===");

  console.log("\n=== 1. 定义扩展：setup 里用 ctx.tools.register ===");
  const helloTools = defineExtension({
    name: "hello-tools",
    version: "0.1.0",
    description: "演示扩展：安装时通过 ctx.tools.register 注册一个 double 工具",
    setup(ctx) {
      ctx.tools.register(double);
      ctx.log("已注册 double");
    },
  });

  const registry = new ToolRegistry();
  const extensions = new ExtensionRegistry({ tools: registry });
  extensions.install(helloTools);
  console.log(`install(hello-tools) 完成，扩展清单：${extensions.list().map((e) => e.name).join(", ")}`);

  console.log("\n=== 2. 验证：工具真的进了 registry ===");
  console.log(`registry.list() → ${registry.list().map((t) => t.name).join(", ")}`);
  const result = await registry.execute({ id: "c1", name: "double", arguments: { n: 21 } });
  console.log(`registry.execute({ name: "double", arguments: { n: 21 } }) → ${JSON.stringify(result)}`);

  console.log("\n=== 3. 边界：扩展注册重名工具，install 整个失败 ===");
  const helloConflict = defineExtension({
    name: "hello-conflict",
    version: "0.1.0",
    description: "试图注册一个同名工具",
    setup(ctx) {
      ctx.tools.register(double);
    },
  });
  try {
    extensions.install(helloConflict);
  } catch (error) {
    console.log(`  install(hello-conflict) → 拒绝：${(error as Error).message}`);
  }
  console.log(`扩展清单仍然只有：${extensions.list().map((e) => e.name).join(", ")}（setup 抛异常，扩展不登记）`);
}

main();