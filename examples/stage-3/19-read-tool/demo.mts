import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createReadTool } from "../../../src/tools/read";
import { Workspace } from "../../../src/workspace/workspace";
import type { ToolResult } from "../../../src/tools/tool";

const exampleDir = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.join(exampleDir, "workspace");

function printResult(label: string, result: ToolResult): void {
  if (result.ok) {
    const value = String(result.value);
    const shown = value.length > 80 ? `${value.slice(0, 80)}…（${value.length} 字符）` : value;
    console.log(`[ok]   ${label}\n       → ${shown}`);
  } else {
    console.log(`[fail] ${label}\n       → [${result.kind}] ${result.error}`);
  }
}

async function main() {
  const read = createReadTool(new Workspace(workspaceRoot));

  console.log("=== 1. 正常读取 workspace 内文件 ===");
  printResult("workspace/src/hello.ts", await read.execute({ path: "src/hello.ts" }));

  console.log("=== 2. 读取目录 → 拒绝 ===");
  printResult("path=src", await read.execute({ path: "src" }));

  console.log("=== 3. 路径穿越 ../README.md → 拒绝（permission） ===");
  printResult("path=../README.md", await read.execute({ path: "../README.md" }));

  console.log("=== 4. 绝对路径指向 workspace 外 → 拒绝（permission） ===");
  printResult(`path=${path.join(os.tmpdir(), "secret.txt")}`, await read.execute({ path: path.join(os.tmpdir(), "secret.txt") }));

  console.log("=== 5. 文件不存在 → 读取失败 ===");
  printResult("path=nope.txt", await read.execute({ path: "nope.txt" }));

  console.log("=== 6. 超长文件 → 自动截断 ===");
  const tmpRoot = await mkdtemp(path.join(os.tmpdir(), "hh-19-workspace-"));
  try {
    const longPath = path.join(tmpRoot, "long.txt");
    const longContent = "A".repeat(100) + "\n" + "B".repeat(10000);
    await writeFile(longPath, longContent, "utf-8");
    const readLong = createReadTool(new Workspace(tmpRoot));
    printResult("path=long.txt（11004 字符）", await readLong.execute({ path: "long.txt" }));
  } finally {
    await rm(tmpRoot, { recursive: true, force: true });
  }
}

main();
