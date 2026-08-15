import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createWriteTool } from "../../../src/tools/write";
import { Workspace } from "../../../src/workspace/workspace";
import type { ToolResult } from "../../../src/tools/tool";

function printResult(label: string, result: ToolResult): void {
  if (result.ok) {
    console.log(`[ok]   ${label}\n       → ${result.value}`);
  } else {
    console.log(`[fail] ${label}\n       → [${result.kind}] ${result.error}`);
  }
}

async function main() {
  const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), "hh-20-workspace-"));
  const write = createWriteTool(new Workspace(workspaceRoot));

  try {
    await mkdir(path.join(workspaceRoot, "src"));
    await writeFile(path.join(workspaceRoot, "src", "hello.ts"), "export const hello = 1;\n", "utf-8");

    console.log("=== 1. 新建文件 → 成功（新建文件） ===");
    printResult("write src/notes.txt", await write.execute({ path: "src/notes.txt", content: "hello harness\n" }));

    console.log("=== 2. 覆盖已有文件 → 成功（覆盖已有文件） ===");
    printResult("write src/hello.ts", await write.execute({ path: "src/hello.ts", content: "export const hello = 2;\n" }));

    console.log("=== 3. 写入相同内容 → 成功（内容未变化） ===");
    printResult("write src/hello.ts", await write.execute({ path: "src/hello.ts", content: "export const hello = 2;\n" }));

    console.log("=== 4. 嵌套目录自动创建 → 成功（新建文件） ===");
    printResult("write docs/guide/readme.md", await write.execute({ path: "docs/guide/readme.md", content: "# Guide\n" }));

    console.log("=== 5. 路径穿越 ../outside.txt → 拒绝（permission） ===");
    printResult("path=../outside.txt", await write.execute({ path: "../outside.txt", content: "x" }));

    console.log("=== 6. 绝对路径指向 workspace 外 → 拒绝（permission） ===");
    printResult(
      `path=${path.join(os.tmpdir(), "secret.txt")}`,
      await write.execute({ path: path.join(os.tmpdir(), "secret.txt"), content: "x" }),
    );

    console.log("=== 7. 目标是目录 → 拒绝（tool） ===");
    printResult("path=src", await write.execute({ path: "src", content: "x" }));

    console.log("=== 8. content 缺失或非字符串 → 拒绝（tool） ===");
    printResult("path=src/a.txt", await write.execute({ path: "src/a.txt" }));
    printResult("path=src/b.txt content=123", await write.execute({ path: "src/b.txt", content: 123 as unknown }));

    console.log("\n=== 写后校验：read 回读 ===");
    const readBack = await readFile(path.join(workspaceRoot, "docs", "guide", "readme.md"), "utf-8");
    console.log(`docs/guide/readme.md → ${JSON.stringify(readBack)}`);
  } finally {
    await rm(workspaceRoot, { recursive: true, force: true });
  }
}

main();
