#!/usr/bin/env node
import { tsImport } from "tsx/esm/api";
import { fileURLToPath, pathToFileURL } from "node:url";
import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";

function loadEnvIfExists(filePath) {
  if (existsSync(filePath)) {
    process.loadEnvFile(filePath);
  }
}

// 优先加载当前目录的 .env；没有则在用户主目录下查找
loadEnvIfExists(path.resolve(process.cwd(), ".env"));
loadEnvIfExists(path.join(os.homedir(), ".env"));

const args = process.argv.slice(2);
const hasMode = args.some((a) => ["--tools", "--chat", "--stream", "--full", "-h", "--help"].includes(a));
if (!hasMode) args.unshift("--tools");

const entry = path.join(path.dirname(fileURLToPath(import.meta.url)), "../packages/cli/src/main.ts");
process.argv = [process.argv[0], entry, ...args];

await tsImport(pathToFileURL(entry).href, import.meta.url);