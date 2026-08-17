import { ExtensionRegistry, defineExtension } from "../../../src/extensions";

function hr(title: string): void {
  console.log(`\n=== ${title} ===`);
}

async function main() {
  console.log("=== 30 · Extension API：让能力在 Core 之外生长 ===");

  hr("1. 编写扩展（defineExtension）");
  const helloHello = defineExtension({
    name: "hello-hello",
    version: "0.1.0",
    description: "打招呼：安装时向 harness 报到",
    setup(ctx) {
      ctx.log(`你好，我是 ${ctx.name}，已挂载到 harness`);
    },
  });

  const status = defineExtension({
    name: "status",
    version: "0.2.0",
    description: "报告一次安装信息",
    setup(ctx) {
      ctx.log(`status：扩展名「${ctx.name}」安装成功，setup 已执行一次`);
    },
  });

  console.log("已定义 2 个扩展：hello-hello、status（每个都只有 name + setup）");

  hr("2. 安装到 ExtensionRegistry");
  const extensions = new ExtensionRegistry();
  extensions.install(helloHello);
  extensions.install(status);
  console.log("install() 完成：2 个扩展进入 active，setup 各执行恰好一次");

  hr("3. 扩展清单（manifest）");
  for (const ext of extensions.list()) {
    console.log(`  ${ext.name}@${ext.version ?? "-"} (${ext.status}) — ${ext.description ?? ""}`);
  }

  hr("4. 边界校验：install() 的三道闸门");
  try {
    extensions.install(status);
  } catch (error) {
    console.log(`  install(status) 重复安装      → 拒绝：${(error as Error).message}`);
  }
  try {
    extensions.install(defineExtension({ name: "", setup() {} }));
  } catch (error) {
    console.log(`  install({ name: "" }) 空名    → 拒绝：${(error as Error).message}`);
  }
  try {
    extensions.install(helloHello);
  } catch (error) {
    console.log(`  install(helloHello) 重复安装  → 拒绝：${(error as Error).message}`);
  }
  console.log(`清单仍然只有 ${extensions.list().length} 个扩展——被拒绝的 install 不留下任何痕迹。`);
}

main();