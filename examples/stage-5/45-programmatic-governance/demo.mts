import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import type { Model, ToolCall } from "@hello-harness/core";
import { AgentRuntime, HookManager, ToolRegistry, systemMessage, userMessage } from "@hello-harness/core";
import { ExtensionRegistry, createTraceHookExtension } from "@hello-harness/extensions";
import {
  Workspace,
  createReadTool,
  createWriteTool,
  createEditTool,
  createBashTool,
  createGlobTool,
  createCodeActionTool,
  createDefaultPermissionGate,
  calculator,
} from "@hello-harness/coding";

const scratch = path.join(os.tmpdir(), "hello-harness-45-programmatic-governance");
rmSync(scratch, { recursive: true, force: true });
mkdirSync(path.join(scratch, "src"), { recursive: true });
writeFileSync(path.join(scratch, "src", "utils.ts"), "// utils.ts\nexport const answer = 42;\n", "utf-8");

// —— 真实 Harness：工具 + 默认权限门 + 能力治理参数 ——
const workspace = new Workspace(scratch);
const gate = createDefaultPermissionGate();
const registry = new ToolRegistry({ gate });

registry.register(createReadTool(workspace));
registry.register(createWriteTool(workspace));
registry.register(createEditTool(workspace));
registry.register(createBashTool(workspace, { timeoutMs: 1000 }));
registry.register(createGlobTool(workspace));
registry.register(calculator);
// 主 code 工具：默认能力白名单（glob/read/write/edit/bash） + 预算 8（便于演示预算溢出）
registry.register(
  createCodeActionTool(workspace, registry, {
    maxProgramCapabilityCalls: 8,
  }),
);
// 严格版 code_strict：能力白名单收窄到 read/glob/bash（edit 已注入但被清单拒），预算 6
const strictTool = createCodeActionTool(workspace, registry, {
  programCapabilities: ["read", "glob", "bash"],
  maxProgramCapabilityCalls: 6,
});
registry.register({ ...strictTool, name: "code_strict" });

const askLog: string[] = [];
gate.setAsk(async (call) => {
  askLog.push(call.name);
  return true;
});

const hooks = new HookManager();
const extensions = new ExtensionRegistry({ tools: registry, hooks });
extensions.install(createTraceHookExtension());

// P1：权限门矩阵——只读放行 / 危险拒绝 / 敏感路径拒绝 / ask 放行 / 工具级超时
const P1 = [
  `const head = (await read("src/utils.ts")).trim().split("\\n")[0];`,
  `let deniedDanger = "", deniedProtected = "";`,
  `try { await bash("rm -rf ."); } catch (e) { deniedDanger = e.message; }`,
  `try { await write(".sessions/secret.txt", "secret"); } catch (e) { deniedProtected = e.message; }`,
  `const quick = await bash("node -e \\"console.log('ask ok')\\"");`,
  `const slow = await bash("node -e \\"setTimeout(()=>{}, 6000)\\"");`,
  `print("读文件（allow）：" + head);`,
  `print("危险命令（deny，被捕获）：" + deniedDanger);`,
  `print("敏感路径写入（deny，被捕获）：" + deniedProtected);`,
  `print("普通命令（ask → 放行）：stdout = " + quick.stdout.trim());`,
  `print("长任务（bash 工具超时 1s → timedOut）: " + slow.timedOut);`,
].join("\n");

// P2：三道治理闸——清单拒 / require 白名单 / 预算 + 终止开关（跑在 code_strict 上）
const P2 = [
  `let editDenied = "", calcRefused = "", fsDenied = "", budgetMsg = "", afterMsg = "";`,
  `try { await edit("src/utils.ts", "export const answer", "export const THE_ANSWER"); } catch (e) { editDenied = e.message; }`,
  `try { await calculator("2+3"); } catch (e) { calcRefused = e.message; }`,
  `try { require("fs"); } catch (e) { fsDenied = e.message; }`,
  `const rel = require("path").basename("a/b.ts");`,
  `try { for (let i = 0; i < 20; i++) { await glob("src/**/*.ts"); } } catch (e) { budgetMsg = e.message; }`,
  `try { await glob("src/**/*.ts"); } catch (e) { afterMsg = e.message; }`,
  `print("edit 已注入但不在清单（清单拒）：" + editDenied);`,
  `print("calculator 已注册但未注入（程序世界里不存在）：" + calcRefused);`,
  `print("require fs（白名单拒）：" + fsDenied);`,
  `print("require path（放行）：" + rel);`,
  `print("预算 6 次（溢出，拒）：" + budgetMsg);`,
  `print("预算触顶后再次调用（已终止，拒）：" + afterMsg);`,
].join("\n");

// P3：不捕获拒绝 → 整个 code 以 kind=permission 失败，结构化拒绝回填模型上下文
const P3 = `await bash("rm -rf .");\nprint("不会执行到这里");`;

function createGovernanceModel(): Model {
  const script: Array<{ content: string; toolCalls: ToolCall[] }> = [
    {
      content: "第 1 段程序：把只读放行 / 危险拒绝 / 敏感路径拒绝 / ask 放行 / 工具超时全部试探一遍。",
      toolCalls: [{ id: "g1", name: "code", arguments: { code: P1 } }],
    },
    {
      content: "第 2 段程序：用 code_strict（清单收窄 + 预算 6）验证三块治理闸——清单拒、require 白名单、预算与终止开关。",
      toolCalls: [{ id: "g2", name: "code_strict", arguments: { code: P2 } }],
    },
    {
      content: "第 3 段程序：故意不捕获危险命令，观察拒绝是不是以 kind=permission 原样回填。",
      toolCalls: [{ id: "g3", name: "code", arguments: { code: P3 } }],
    },
    {
      content:
        "结构化拒绝（kind=permission）原样回了上下文；这段运行里 read/bash/glob/edit 的内层调用也进入了事件流与 Hook。治理对程序化调用照样生效。",
      toolCalls: [],
    },
  ];
  let index = 0;
  return {
    modelName: "mock-governance",
    async generate() {
      const item = script[Math.min(index++, script.length - 1)];
      return { content: item.content, toolCalls: item.toolCalls, inputTokens: 600, outputTokens: 120 };
    },
    async *stream() {
      throw new Error("本 demo 使用 generate 模式");
    },
  };
}

async function main() {
  console.log("=== 45 · Programmatic Governance：能力白名单 + require 白名单 + 预算/终止 + 内层事件 ===\n");

  const runtime = new AgentRuntime(createGovernanceModel(), registry, { hooks, maxSteps: 8 });
  const isInner = (call: ToolCall): boolean => call.id.startsWith("program-");

  runtime.on("run:start", (e) => {
    console.log(`[run:start ] Run ID : ${e.runId}`);
    console.log(`[run:start ] Input  : ${e.input}`);
  });
  runtime.on("model:start", () => {
    console.log(`[model:start] 思考中 …`);
  });
  runtime.on("model:end", (e) => {
    const detail =
      e.response.toolCalls.length > 0
        ? `决策 → 调用工具：${e.response.toolCalls.map((c) => c.name).join(", ")}`
        : "决策 → 无工具调用，收尾";
    console.log(`[model:end ] ${detail} · ${e.response.inputTokens} in / ${e.response.outputTokens} out · ${e.durationMs}ms`);
  });
  runtime.on("tool:start", (e) => {
    if (isInner(e.call)) {
      console.log(`   · 事件流[tool:start] ${e.call.name}(...)（程序内调用，runId 同一）`);
      return;
    }
    const argText = JSON.stringify(e.call.arguments);
    console.log(`[tool:start] ${e.call.name}(${argText.length > 60 ? `${argText.slice(0, 60)}…` : argText})`);
  });
  runtime.on("tool:end", (e) => {
    if (isInner(e.call)) {
      console.log(`   · 事件流[tool:end ] ${e.call.name} → ok=${e.result.ok} · ${e.durationMs}ms`);
      return;
    }
    const value = e.result.ok ? e.result.value : undefined;
    if (value && typeof value === "object" && Array.isArray((value as { calls?: string[] }).calls)) {
      const typed = value as { calls: string[]; printed: string[]; denied: string[] };
      for (const call of typed.calls) console.log(`   [能力] ${call}`);
      for (const line of typed.printed) console.log(`   [结果] ${line}`);
      if (typed.denied.length > 0) {
        console.log(`   [桥闸拒绝]`);
        for (const d of typed.denied) console.log(`      - ${d}`);
      }
      console.log(`[tool:end  ] → ok=true · ${e.durationMs}ms`);
    } else if (e.result.ok) {
      console.log(`[tool:end  ] → ok=true · ${e.durationMs}ms`);
    } else {
      console.log(`[tool:end  ] → 失败：${e.result.error}（kind=${e.result.kind}）· ${e.durationMs}ms`);
    }
  });
  runtime.on("run:end", (e) => {
    console.log(`[run:end   ] ${e.status} (${e.stopReason}) · ${e.durationMs}ms\n`);
  });

  const run = await runtime.run({
    messages: [
      systemMessage("你是一个严谨的 Coding Agent。"),
      userMessage("验证程序化调用下：能力白名单、require 白名单、预算/终止、内层事件与 Hook。"),
    ],
  });

  const probe = async (name: string, arguments_: unknown): Promise<string> => {
    const decision = await gate.decide({ id: "probe", name, arguments: arguments_ } satisfies ToolCall);
    return decision.action === "allow"
      ? `allow${decision.reason ? `（${decision.reason}）` : ""}`
      : decision.action === "deny"
        ? `deny（${decision.reason}）`
        : `ask（${decision.reason}）`;
  };

  console.log("=== 判定矩阵：权限门三态（对程序内能力照样出声） ===");
  const items: Array<[string, string, unknown]> = [
    ["read(\"src/utils.ts\") 读文件", "read", { path: "src/utils.ts" }],
    ["bash(\"node --version\") 只读命令", "bash", { command: "node --version" }],
    ["bash(\"node -e …\") 普通命令", "bash", { command: 'node -e "console.log(1)"' }],
    ["write(\".sessions/secret\") 敏感路径", "write", { path: ".sessions/secret.txt", content: "x" }],
    ["bash(\"rm -rf .\") 危险命令", "bash", { command: "rm -rf ." }],
  ];
  for (const [label, name, args] of items) {
    console.log(`  ${label}`);
    console.log(`    权限门判定 = ${await probe(name, args)}`);
  }

  const asks = askLog.reduce((acc, name) => ((acc[name] = (acc[name] ?? 0) + 1), acc), {} as Record<string, number>);
  console.log(`\n  ask 触发记录：${Object.entries(asks).map(([k, v]) => `${k}×${v}`).join("、")}（模拟用户放行）`);
  console.log(`  运行档案：${run.iterations} 轮 · ${run.steps.length} 步 · Run ID ${run.id}\n`);

  console.log("=== 对账：ch44 的三笔债 ===");
  console.log("① 控制流没人逐行审查");
  console.log("   解法：能力清单收窄能力面 + 预算上限 + 终止开关 → 程序变成「有界的黑盒」；");
  console.log("        控制流依然不可见，但能碰的世界（清单）、能用几次（预算）、结束后还能不能再动手（终止）全被闸住。");
  console.log("   注：清单 = 注入面 ∩ 注册表。注入了但被清单剔的（edit 之于 code_strict）→ 清单拒；");
  console.log("        注册表里有但注入面没给的（calculator）→ 程序世界里根本不存在这个名字（ReferenceError）。");
  console.log("② require 一扇没关的门");
  console.log("   解法：require 白名单（path / util / os），fs / child_process 等一律拒绝并记录在轨迹里。");
  console.log("③ 内层能力调用不产生 Runtime 事件");
  console.log("   解法：内层调用复用当前运行期的事件与 Hook——本轮轨迹里 read/bash/glob/edit 的");
  console.log("        tool:start / tool:end 与 trace-hook 的 beforeTool / afterTool 同样出现。");
  console.log("   附带修复：ch44 记录的 ProgrammaticCallError 字段碰撞（name→toolName）。");
  console.log("");
}

main();