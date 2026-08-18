import { spawnSync } from "node:child_process";

const started = Date.now();
const result = spawnSync("npm", ["test"], { stdio: "inherit", shell: true });
const elapsedMs = Date.now() - started;
console.log(`测试${result.status === 0 ? "通过" : "失败"} · ${elapsedMs}ms`);
process.exit(result.status ?? 1);
