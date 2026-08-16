#!/usr/bin/env node
import { tsImport } from "tsx/esm/api";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

try {
  process.loadEnvFile();
} catch {
  // 没有 .env 时忽略
}

const args = process.argv.slice(2);
const hasMode = args.some((a) => ["--tools", "--chat", "--stream", "--full", "-h", "--help"].includes(a));
if (!hasMode) args.unshift("--tools");

const entry = path.join(path.dirname(fileURLToPath(import.meta.url)), "../src/cli/index.ts");
process.argv = [process.argv[0], entry, ...args];

await tsImport(pathToFileURL(entry).href, import.meta.url);