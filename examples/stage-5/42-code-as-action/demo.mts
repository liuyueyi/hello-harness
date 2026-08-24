interface SourceFile {
  path: string;
  content: string;
}

interface CapabilityEvent {
  name: string;
  input: string;
  output: string;
}

interface FileCapabilities {
  list(prefix: string): Promise<string[]>;
  read(path: string): Promise<string>;
  write(path: string, content: string): Promise<void>;
}

interface Capabilities {
  files: FileCapabilities;
}

function createMemoryCapabilities(sourceFiles: SourceFile[]): {
  capabilities: Capabilities;
  events: CapabilityEvent[];
  writtenFiles: Map<string, string>;
} {
  const source = new Map(sourceFiles.map((file) => [file.path, file.content]));
  const writtenFiles = new Map<string, string>();
  const events: CapabilityEvent[] = [];

  return {
    capabilities: {
      files: {
        async list(prefix: string): Promise<string[]> {
          const paths = [...source.keys()].filter((path) => path.startsWith(prefix)).sort();
          events.push({ name: "files.list", input: JSON.stringify({ prefix }), output: `${paths.length} paths` });
          return paths;
        },
        async read(path: string): Promise<string> {
          const content = source.get(path);
          if (content === undefined) throw new Error(`文件不存在：${path}`);
          events.push({ name: "files.read", input: JSON.stringify({ path }), output: `${content.length} chars` });
          return content;
        },
        async write(path: string, content: string): Promise<void> {
          writtenFiles.set(path, content);
          events.push({ name: "files.write", input: JSON.stringify({ path }), output: `${content.length} chars` });
        },
      },
    },
    events,
    writtenFiles,
  };
}

/**
 * 假定这是模型针对任务生成的一段 JavaScript Code Action。
 *
 * 这里直接调用它，只是为了在第 42 章观察「代码如何组合 Capability」。
 * 它不是 CodeRuntime：没有 execute(code)、没有代码字符串求值、没有持久状态，
 * 也没有权限、超时、取消或沙箱。这些边界由第 43 章以后逐步补上。
 */
async function auditTimeouts(capabilities: Capabilities): Promise<{ filesScanned: number; findings: number; report: string }> {
  const paths = await capabilities.files.list("src/");
  const files = await Promise.all(
    paths.map(async (path) => ({ path, content: await capabilities.files.read(path) })),
  );

  const findings = files.flatMap(({ path, content }) =>
    content
      .split("\n")
      .map((line, index) => ({ path, line: index + 1, text: line.trim() }))
      .filter(({ text }) => /timeout/i.test(text)),
  );

  const report = [
    "# Timeout audit",
    "",
    `扫描文件：${files.length}`,
    `发现配置：${findings.length}`,
    "",
    ...findings.map((finding) => `- ${finding.path}:${finding.line} — \`${finding.text}\``),
  ].join("\n");

  await capabilities.files.write("reports/timeouts.md", report);
  return { filesScanned: files.length, findings: findings.length, report };
}

const { capabilities, events, writtenFiles } = createMemoryCapabilities([
  { path: "src/api.ts", content: "export const apiTimeout = 3000;\nexport const retries = 2;" },
  { path: "src/cache.ts", content: "export const cacheTtl = 60_000;" },
  { path: "src/worker.ts", content: "const timeoutMs = 5_000;\nexport { timeoutMs };" },
]);

const result = await auditTimeouts(capabilities);

console.log("=== 42 · Code as Action：一段程序组合 Capability ===");
console.log("模型动作        : auditTimeouts(capabilities) 这一段代码");
console.log("程序内编排      : 局部变量 · Promise.all · map / filter / flatMap · 条件匹配");
console.log(`扫描结果        : ${result.filesScanned} 个文件 · ${result.findings} 处 timeout 配置`);
console.log(`Capability 调用 : ${events.length} 次（发生在同一段程序内部）`);
console.log("额外模型往返    : 0 次（本 demo 只观察一次 Code Action 的内部编排）");

console.log("\nCapability 轨迹：");
for (const event of events) {
  console.log(`  ${event.name}(${event.input}) → ${event.output}`);
}

console.log("\n写入的报告：");
console.log(writtenFiles.get("reports/timeouts.md"));

console.log("\n注意：这是概念 demo。真正的 CodeRuntime、代码字符串执行、权限、超时、取消与重置，从第 43 章开始实现。");
