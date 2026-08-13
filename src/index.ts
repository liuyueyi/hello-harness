// Stage 0 / 00 · 项目初始化
// 本章不调用任何模型，只验证最小 TypeScript + pnpm 工程能运行、
// 以及环境变量约定（.env → process.env）已经生效。

function main() {
  console.log("Hello, Harness!");

  console.log(`  node         ${process.version}`);
  console.log(`  cwd          ${process.cwd()}`);

  const apiKey = process.env.OPENAI_API_KEY;
  if (apiKey) {
    console.log("  OPENAI_API_KEY  已配置");
  } else {
    console.warn("  OPENAI_API_KEY  未配置（复制 .env.example 为 .env 后填入）");
  }
}

main();