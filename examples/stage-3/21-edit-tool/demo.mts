import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createEditTool } from "../../../src/tools/edit";
import { Workspace } from "../../../src/workspace/workspace";
import type { ToolResult } from "../../../src/core/tool/tool";

function printResult(label: string, result: ToolResult): void {
  if (result.ok) {
    console.log(`[ok]   ${label}\n       → ${result.value}`);
  } else {
    console.log(`[fail] ${label}\n       → [${result.kind}] ${result.error}`);
  }
}

async function main() {
  const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), "hh-21-workspace-"));
  const edit = createEditTool(new Workspace(workspaceRoot));

  try {
    await mkdir(path.join(workspaceRoot, "src"));
    await writeFile(
      path.join(workspaceRoot, "src", "hello.ts"),
      "export function greet(name: string): string {\n  return `Hello, ${name}!`;\n}\n\nconst message = greet(\"harness\");\nconsole.log(message);\n",
      "utf-8",
    );

    console.log("=== 1. 唯一匹配 → 精准替换成功 ===");
    printResult(
      'edit src/hello.ts "Hello, ${name}!`" → "Hi, ${name}!`"',
      await edit.execute({ path: "src/hello.ts", oldString: "Hello, ${name}!`;", newString: "Hi, ${name}!`;" }),
    );

    console.log("=== 2. oldString 未找到 → 失败（tool） ===");
    printResult(
      'edit src/hello.ts "nonexistent" → "x"',
      await edit.execute({ path: "src/hello.ts", oldString: "function notHere() {}", newString: "function here() {}" }),
    );

    console.log("=== 3. oldString 出现多次 → 失败（不唯一） ===");
    await writeFile(
      path.join(workspaceRoot, "src", "hello.ts"),
      "export function greet(name: string): string {\n  return `Hello, ${name}!`;\n}\n\nconst message = greet(\"harness\");\nconsole.log(message);\n",
      "utf-8",
    );
    printResult(
      'edit src/hello.ts "greet" → "hi"',
      await edit.execute({ path: "src/hello.ts", oldString: "greet", newString: "hi" }),
    );

    console.log("=== 4. oldString 为空 → 失败（tool） ===");
    printResult(
      "edit src/hello.ts oldString=''",
      await edit.execute({ path: "src/hello.ts", oldString: "", newString: "x" }),
    );

    console.log("=== 5. 路径穿越 ../outside.txt → 拒绝（permission） ===");
    printResult(
      "path=../outside.txt",
      await edit.execute({ path: "../outside.txt", oldString: "a", newString: "b" }),
    );

    console.log("=== 6. 绝对路径指向 workspace 外 → 拒绝（permission） ===");
    printResult(
      `path=${path.join(os.tmpdir(), "secret.txt")}`,
      await edit.execute({ path: path.join(os.tmpdir(), "secret.txt"), oldString: "a", newString: "b" }),
    );

    console.log("=== 7. 目标是目录 → 失败（tool） ===");
    printResult("path=src", await edit.execute({ path: "src", oldString: "a", newString: "b" }));

    console.log("=== 8. 文件不存在 → 失败（tool） ===");
    printResult("path=nope.ts", await edit.execute({ path: "nope.ts", oldString: "a", newString: "b" }));

    console.log("=== 9. newString 为空 → 删除片段 ===");
    printResult(
      'edit src/hello.ts "const message" → ""',
      await edit.execute({ path: "src/hello.ts", oldString: "\n\nconst message = greet(\"harness\");", newString: "\n" }),
    );

    console.log("\n=== 替换后校验：read 回读 ===");
    const readBack = await readFile(path.join(workspaceRoot, "src", "hello.ts"), "utf-8");
    console.log(`src/hello.ts → ${JSON.stringify(readBack)}`);
  } finally {
    await rm(workspaceRoot, { recursive: true, force: true });
  }
}

main();
