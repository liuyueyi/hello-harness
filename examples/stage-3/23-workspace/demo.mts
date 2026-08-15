import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Workspace } from "../../../src/workspace/workspace";
import { createReadTool } from "../../../src/tools/read";
import { createWriteTool } from "../../../src/tools/write";
import { createEditTool } from "../../../src/tools/edit";
import { createBashTool } from "../../../src/tools/bash";
import type { BashResult } from "../../../src/tools/bash";
import type { ToolResult } from "../../../src/tools/tool";

function printResult(label: string, result: ToolResult): void {
  if (result.ok) {
    const value = result.value as string | BashResult;
    const shown =
      typeof value === "string"
        ? value.length > 90
          ? `${value.slice(0, 90)}…（${value.length} 字符）`
          : value
        : `exitCode=${value.exitCode} ${JSON.stringify(value.stdout)}`;
    console.log(`[ok]   ${label}\n       → ${shown}`);
  } else {
    console.log(`[fail] ${label}\n       → [${result.kind}] ${result.error}`);
  }
}

async function main() {
  const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), "hh-23-workspace-"));
  const workspace = new Workspace(workspaceRoot);

  const read = createReadTool(workspace);
  const write = createWriteTool(workspace);
  const edit = createEditTool(workspace);
  const bash = createBashTool(workspace);

  try {
    await mkdir(path.join(workspaceRoot, "src"));
    await writeFile(
      path.join(workspaceRoot, "src", "hello.ts"),
      "export const greeting = \"hello\";\n",
      "utf-8",
    );

    console.log("=== 0. 一个 Workspace 收口文件系统 ===");
    console.log(`root    : ${workspace.root}`);
    console.log(`resolve : ${workspace.resolve("src/hello.ts")}`);
    console.log(`exists  : ${await workspace.exists("src/hello.ts")} / ${await workspace.exists("nope.ts")}`);
    console.log(`isFile  : ${await workspace.isFile("src/hello.ts")} / ${await workspace.isFile("src")}`);

    console.log("\n=== 1. 四个工具共享同一个 Workspace ===");
    printResult("read src/hello.ts", await read.execute({ path: "src/hello.ts" }));

    console.log("\n=== 2. 编辑后通过 bash 验证 ===");
    printResult(
      'edit "hello" → "harness"',
      await edit.execute({ path: "src/hello.ts", oldString: "hello", newString: "harness" }),
    );
    printResult('bash("node -e ...")', await bash.execute({ command: 'node -e "console.log(process.cwd())"' }));

    console.log("\n=== 3. 越界护栏：同一个 resolve 挡住所有工具 ===");
    printResult("read ../secret.txt", await read.execute({ path: "../secret.txt" }));
    printResult("write ../secret.txt", await write.execute({ path: "../secret.txt", content: "x" }));
    printResult("edit ../secret.txt", await edit.execute({ path: "../secret.txt", oldString: "a", newString: "b" }));

    console.log("\n=== 4. 嵌套写入 → 目录自动创建 ===");
    printResult("write docs/guide/readme.md", await write.execute({ path: "docs/guide/readme.md", content: "# Guide\n" }));
    printResult('bash("dir /s /b")', await bash.execute({ command: "node -e \"const fs=require('fs'),path=require('path');(function walk(d,p){fs.readdirSync(d,{withFileTypes:true}).forEach(e=>{const f=path.join(d,e.name);const rel=path.join(p,e.name);console.log((e.isDirectory()?'[d] ':'[f] ')+rel);if(e.isDirectory())walk(f,rel)});})(process.cwd(),'')\"" }));
  } finally {
    await rm(workspaceRoot, { recursive: true, force: true });
  }
}

main();
