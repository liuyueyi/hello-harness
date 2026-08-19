import { defineExtension } from "@hello-harness/extensions";
import { createFetchUrlTool } from "./web";

export function createWebExtension() {
  return defineExtension({
    name: "web",
    version: "0.1.0",
    description: "独立发布的 Web 扩展包（@hello-harness/web）：fetch_url 工具，仅 HTTP GET，出网行为交给默认权限门（ask）",
    setup(ctx) {
      ctx.tools.register(createFetchUrlTool());
    },
  });
}

export default createWebExtension;
