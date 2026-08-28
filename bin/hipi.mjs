#!/usr/bin/env node
import { tsImport } from "tsx/esm/api";
import { fileURLToPath, pathToFileURL } from "node:url";
import { existsSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

function parseEnv(content) {
  const out = {};
  for (const rawLine of content.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

function loadEnvIfMissing(filePath) {
  if (!existsSync(filePath)) return;
  const parsed = parseEnv(readFileSync(filePath, "utf-8"));
  for (const [key, value] of Object.entries(parsed)) {
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

// 加载顺序：当前项目 .env 优先，其次 ~/.hello/.env，最后 ~/.env
// 已存在的变量不被覆盖，因此「项目配置」优先于「用户全局配置」
loadEnvIfMissing(path.resolve(process.cwd(), ".env"));
loadEnvIfMissing(path.join(os.homedir(), ".hello", ".env"));
loadEnvIfMissing(path.join(os.homedir(), ".env"));

const args = process.argv.slice(2);
const hasMode = args.some((a) =>
  ["--tools", "--chat", "--stream", "--full", "--pi", "-h", "--help"].includes(a),
);
if (!hasMode) args.unshift("--pi");

const entry = path.join(path.dirname(fileURLToPath(import.meta.url)), "../packages/cli/src/main.ts");
process.argv = [process.argv[0], entry, ...args];

await tsImport(pathToFileURL(entry).href, import.meta.url);
