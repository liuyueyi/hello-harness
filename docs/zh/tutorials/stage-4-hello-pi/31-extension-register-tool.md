---
title: "31 · Extension 注册 Tool"
description: "让 ExtensionContext 长大第一个能力：ctx.tools。把 hello-coding 的 6 个工具（calculator/random/read/write/edit/bash）从 createAgent 迁入扩展，工具由扩展声明注册，叠加双重注册表防线。"
gitTag: "v31-extension-tool"
stage: 4
---

# 31 · Extension 注册 Tool

> <span class="stage-badge">Stage Hello Pi</span> · <span class="tag-badge">v31-extension-tool</span>

第三十章，我们给 Core 的墙开了一个口子——`Extension = name + setup(ctx)`，配上 `ExtensionRegistry` 插座。`hello --extensions` 能列出已装扩展，`hello-coding` 也立了身份。

但收工的时候，心里显然还是有点虚的，就怕你多嘴问一句：

> **插座是通了，可插头是空的。** `ctx` 里只有身份和 `log`——扩展装上去能「报个到、喊个话」，却**做不了任何实事**。更扎心的是，工具还在 `cli/index.ts` 的 `createAgent` 里写死——「能力外置」喊了一章，工具一个都没搬出去。

这一章，我们给 `ctx` 接上第一根真正的线：**`ctx.tools`**。把 `hello-coding` 的六个工具（calculator / random / read / write / edit / bash）从「产品壳手写注册」迁成「扩展声明注册」——**能力外置的第一块真骨头**。

## 一、上一版存在什么问题？

ch30 立了插座，也留下三个具体问题：

1. **`ctx` 太空，setup 无事可做**：扩展装上去只能 `ctx.log` 报个到——**它碰不到 harness 的任何能力**，所谓「扩展」目前只是「会说话的门牌」；
2. **工具还写死在产品壳里**：`createAgent` 里 6 行 `registry.register(...)`，工具是谁、有几个、怎么绑 workspace，全由 `cli/index.ts` 决定——**加一个工具，还是要改产品壳**；
3. **「能力外置」缺最后一步**：ch30 立了「扩展 = 能力的统一形态」，但工具这种最典型的能力，**还没有一个扩展用它**——形态是空的，承诺是虚的。

> 一句话：**ch30 通了插座，但没接上线。** 扩展装上去只是「报个到」，真正的能力（工具）还躺在产品壳手里。

## 二、本篇解决什么问题？

这一章做四件事：

1. **`ctx` 长大第一个能力 `tools`**：扩展在 `setup` 里能写 `ctx.tools.register(tool)`——**「装一个扩展」终于能产生真正的效果**；
2. **迁移**：把 `hello-coding` 的空壳填起来，六个工具从 `createAgent` 搬进扩展的 `setup`——**`createAgent` 从「注册 6 个工具」变成「只装 1 个扩展」**；
3. **证明接线**：扩展注册的工具，落进 AgentRuntime 实际使用的那个 `ToolRegistry`——**不是装样子，是真的通电**；
4. **叠加防线**：`ExtensionRegistry` 管扩展名唯一，`ToolRegistry` 管工具名唯一，`setup` 里注册重名工具会**让整个安装失败、不留半装**。

核心心智模型：

> **工具不再由 harness 摊派，而是由扩展声明。** 以前是「产品壳说：你有这 6 个工具」；现在是「扩展说：我提供这 6 个工具」。**谁是能力的所有者，谁才有资格决定能力长什么样。**

## 三、先看最终效果

先跑 demo（无需 API Key）：

```bash
$ node --import tsx examples/stage-4/31-extension-register-tool/demo.mts
```

输出：

```text
=== 31 · Extension 注册 Tool：把工具搬出门外 ===

=== 1. 定义扩展：setup 里用 ctx.tools.register ===
[ext:hello-tools] 已注册 double
install(hello-tools) 完成，扩展清单：hello-tools

=== 2. 验证：工具真的进了 registry ===
registry.list() → double
registry.execute({ name: "double", arguments: { n: 21 } }) → {"ok":true,"value":42}

=== 3. 边界：扩展注册重名工具，install 整个失败 ===
  install(hello-conflict) → 拒绝：工具 double 已注册
扩展清单仍然只有：hello-tools（setup 抛异常，扩展不登记）
```

注意两件事：

1. **接线是真的**：demo 里 `registry` 是我们亲手创建的 `ToolRegistry`，把它交给 `ExtensionRegistry` 后，扩展注册的 `double` 真能 `execute` 出 `42`——**扩展注册的工具，进了 runtime 会用到的那个注册表**；
2. **防线是叠加的**：第二个扩展想再注册同名 `double`，`ToolRegistry` 直接拒绝，异常从 `setup` 冒上来，**整个扩展安装失败**——`extensions.list()` 里没有 `hello-conflict`。

再看产品壳——六个工具已经「出门」了，但 `hello` 照样干活：

```bash
$ hello --extensions
```

```text
Workspace: ...
已安装扩展（manifest）：
  hello-coding@0.4.0 (active) — Coding Agent 本体：6 个工具（calculator/random/read/write/edit/bash）由扩展注册；方法论 prompt 留待 ch33。
```

> 这就是这一章的兑现：**「在 Core 之外生长能力」从口号变成了真实的工具注册。** 加一个工具，从此不用再碰 `cli/index.ts`。

## 四、架构变化

这一章的架构变化：**`ctx` 长出第一个能力，工具的所有权从产品壳移交给扩展。**

```text
src/
  core/tool/registry.ts        ← ToolRegistry（ch10）：工具的注册与执行，unchanged
  extensions/
    extension.ts               ← ExtensionContext 增加 readonly tools: ToolRegistry
    registry.ts                ← ExtensionRegistry 注入 tools，setup(ctx) 带上 tools
    hello-coding.ts            ← 新增：Coding Agent 扩展——6 个工具的注册搬到这里
  cli/index.ts                 ← createAgent：6 行 register 删掉，只留 1 行 install
```

数据流变清晰了：

```text
  cli/createAgent
       │  new ExtensionRegistry({ tools: registry })   ← 插座接上真注册表
       ▼
  ExtensionRegistry.install(hello-coding)
       │  setup(ctx) 里 ctx.tools.register(read/write/edit/bash/...)
       ▼
  ToolRegistry  ← AgentRuntime 每一次 run 都从这里 list() 拿工具
```

**ToolRegistry 从此有了两个入口**：扩展负责「供给」（`ctx.tools.register`），Runtime 负责「消费」（`registry.list()`）。两边互不认识，靠同一个注册表接在一起。

> 关键点：**Core 一行没改。** `ToolRegistry` 是 ch10 就有的东西，扩展只是借它把工具装进来——**新能力长在外面，老核心纹丝不动**，这就是 ch29 想看到的边界。

## 五、核心抽象

这一章的核心抽象只有一个：**`ctx.tools`**。它甚至没有新类型——`ctx.tools` 就是 `ToolRegistry` 本身：

```ts
interface ExtensionContext {
  readonly name: string;
  log(message: string): void;
  readonly tools: ToolRegistry;   // ch31 新增：扩展在这里声明工具
}
```

### 为什么不造一个窄接口，而是直接给 `ToolRegistry`？

这是个值得停下来想的问题。给扩展整个 `ToolRegistry`，意味着扩展还能 `ctx.tools.execute(...)`、`ctx.tools.list()`——权限明显过宽。

但我们选择**先复用，再收窄**：

> **先教学后抽象。** ch31 的目的是让读者看到「工具的所有权从产品壳移交到扩展」这一件事，越直白越好。给整个 `ToolRegistry`，读者一眼看懂「哦，就是把注册表递进去了」。**真正把 `ctx` 收窄成最小能力面，是 ch37 Permission Gate 的活**——到那时我们才会问「扩展到底该被允许碰哪些能力」。

### 双重注册表，两道防线

现在系统里有两个「唯一性」约束，各管各的：

| 注册表 | 管什么 | 唯一性约束 | 违规后果 |
| --- | --- | --- | --- |
| `ExtensionRegistry` | 扩展（ch30） | 扩展名唯一 | `install()` 抛错，扩展不装 |
| `ToolRegistry` | 工具（ch10） | 工具名唯一 | `setup()` 抛错，**整个安装失败** |

`setup()` 抛错 → 扩展不登记——这正是 ch30 定下的「先校验、再 setup、最后登记」顺序的威力：**半装的扩展不存在。**

## 六、实现代码

### `src/extensions/extension.ts`（`ctx` 长大一行）

```ts
import type { ToolRegistry } from "../core/tool/registry";

export interface ExtensionContext {
  readonly name: string;
  log(message: string): void;
  readonly tools: ToolRegistry;  # 新增ToolRegistry，用于后续的工具注册
}
```

### `src/extensions/registry.ts`（注入 `tools`，setup 带上）

```ts
export interface ExtensionRegistryOptions {
  log?: (name: string, message: string) => void;
  tools?: ToolRegistry;
}

export class ExtensionRegistry {
  private readonly tools: ToolRegistry;

  constructor(options: ExtensionRegistryOptions = {}) {
    this.log = options.log ?? ((name, message) => console.log(`[ext:${name}] ${message}`));
    this.tools = options.tools ?? new ToolRegistry();
  }

  install(extension: Extension): void {
    // ... 三道闸门（ch30）不变 ...
    extension.setup({
      name,
      log: (message) => this.log(name, message),
      tools: this.tools,
    });
    this.extensions.set(name, extension);
  }
}
```

一个细节值得点名：**`tools` 是可选的。** 如果不传，扩展注册的工具会落进一个「没人消费」的内部注册表——`ExtensionRegistry` 自己会兜底一个。**「插座要接到线路上才有电」**：demo 里传了真 `registry`，工具才真正通电。

### `src/extensions/hello-coding.ts`（新增：工具搬到这里）

```ts
export function createHelloCodingExtension(workspace: Workspace) {
  return defineExtension({
    name: "hello-coding",
    version: "0.4.0",
    description: "Coding Agent 本体：6 个工具（calculator/random/read/write/edit/bash）由扩展注册；方法论 prompt 留待 ch33。",
    setup(ctx) {
      ctx.tools.register(calculator);
      ctx.tools.register(randomInteger);
      ctx.tools.register(createReadTool(workspace));
      ctx.tools.register(createWriteTool(workspace));
      ctx.tools.register(createEditTool(workspace));
      ctx.tools.register(createBashTool(workspace));
    },
  });
}
```

**为什么是「工厂函数」而不是一个常量？** 因为 `read / write / edit / bash` 是环境敏感的工具，需要 `Workspace`。ch31 的 `ctx` 还没有 workspace，所以我们用**闭包**把环境绑进去：`createHelloCodingExtension(workspace)` 返回一个把 workspace 捕获在 `setup` 里的扩展。

### `src/cli/index.ts`（`createAgent` 瘦身）

关键的对比变动如下图 （将工具的注册，从 index.ts 迁移到 上面的 hello-coding.ts）

![image.png](https://imgbed.ppai.top/file/1786941573551_image.png)

```ts
function createAgent(dir: string): { workspace: Workspace; registry: ToolRegistry; extensions: ExtensionRegistry } {
  const workspace = new Workspace(dir);
  const registry = new ToolRegistry();
  const extensions = new ExtensionRegistry({ log: () => {}, tools: registry });
  extensions.install(createHelloCodingExtension(workspace));
  return { workspace, registry, extensions };
}
```

**6 行 `register` 换成 1 行 `install`。** 这就是「能力外置」最直观的收获：`createAgent` 不再知道任何具体工具的名字。

## 七、运行 Demo

**跑法一：扩展注册工具演示（本章主角，无需 API Key）**：

```bash
$ node --import tsx examples/stage-4/31-extension-register-tool/demo.mts
```

即第三节那三段输出：注册 → 验证通电 → 重名拦截。

**跑法二：看产品壳——工具出门了，清单升到 0.4.0**：

```bash
$ node --import tsx src/cli/index.ts --extensions
```

**跑法三：老姿势全保留——Coding Agent 一样干活**（需要 `.env`）：

```bash
$ hello --dir examples/stage-4/31-extension-register-tool 介绍下这个项目
```

我们通过扩展契约注入的工具列表，都可以正确调用

![image.png](https://imgbed.ppai.top/file/1786941851551_image.png)

> 复测验证的小伙伴，重点观察以下关键证据：

| 观察点 | 期望 | 实测 |
| --- | --- | --- |
| 工具进 registry | `registry.list()` 含扩展注册的工具 | `double` ✓ |
| 通电 | 扩展注册的工具可 `execute` | `{"ok":true,"value":42}` ✓ |
| 重名拦截 | 第二个扩展注册同名工具 → install 失败 | `工具 double 已注册` ✓ |
| 不留半装 | 失败的扩展不进 manifest | 清单仍只有 `hello-tools` ✓ |
| 老 CLI 不破 | `pnpm typecheck` 零报错 | ✓ |
| 产品可见 | `--extensions` 显示 0.4.0 / 6 工具 | `hello-coding@0.4.0` ✓ |

## 八、新架构解决了什么？

- **加工具不再动产品壳**：新的工具 = 在扩展的 `setup` 里加一行（或新增一个扩展）——**`cli/index.ts` 从此与工具清单解耦**；
- **能力的「所有者」变了**：工具由扩展声明、随扩展安装——**谁提供能力，谁决定能力形态**，Harness 只负责装扩展；
- **`ctx` 的成长节奏得到验证**：ch30 身份 + log → ch31 + tools——**每章长大一个能力，读者全程跟得上**；
- **防线叠加不冲突**：扩展名唯一 + 工具名唯一各司其职，`setup` 抛错即整个安装失败——**「半装的扩展不存在」从设计变成了可复现的行为**；
- **Core 的边界再次经受检验**：迁移工具到扩展，Core 一行没改——**「能力在 Core 之外生长」第一次有了字面的生产代码**。

## 九、它又引入了什么问题？

泼盆冷水，看看这条新线还留了哪些坑：

1. **`ctx` 还没有 workspace**：环境敏感的工具只能靠工厂闭包绑定环境——**`ctx` 的能力面才展开一半**，ch32 的 Hook 挂点、ch33 的 prompt 都会继续长大它；
2. **`setup` 抛的错没统一收编**：`ToolRegistry.register` 抛的是裸 `Error`，一路冒到 `install()`——**报错够用，但没走 ch16 的 `HarnessError` 体系**，等扩展做的事变多，这里需要统一收编；
3. **工具注册没有顺序 / 依赖机制**：扩展 A 想注册「依赖扩展 B 已注册的工具」无从表达——**安装顺序就是注册顺序**，ch32 的 Hook 阶段会碰到这个问题；
4. **`ctx.tools` 暴露了完整 `ToolRegistry`**：扩展理论上能 `execute`、`list`，不只是 `register`——**能力面过宽**，ch37 Permission Gate 会真正收窄；
5. **`hello-coding` 仍是代码硬装**：`install(createHelloCodingExtension(workspace))` 写死在 `createAgent`——**扩展还不能从磁盘发现、加载**，那是 ch35 Skill Loader / ch38 Package 的活。

## 十、下一章

工具能「挂上去」了。但紧接着问题就来了：**挂上去之后呢？** runtime 每跑一步，都要跟工具、模型打交道——如果我们想在「模型调用之前拦一道」「工具执行之后看结果」呢？

下一章，我们让 `ctx` 再长大一个能力：**`ctx.hooks`**。注册 `beforeModel` / `afterModel` / `beforeTool` / `afterTool` / `beforeRun` / `afterRun` 六类钩子，让扩展不只是「提供能力」，还能**在能力运行的关键节点插一手**——从「往 harness 里塞东西」到「在 harness 运行中动刀子」。

> **能力能挂上去，只是第一步；能力能「在关键时刻插手」，才是真正的扩展。**

> **Minimal Core + Extension First：这一章把工具搬出了门，下一章让扩展在运行时也说得上话。**

尽信书则不如，以上内容纯属一家之言，因个人能力有限，难免有疏漏和错误之处，如发现 bug 或者有更好的建议，欢迎批评指正，不吝感激 🙃

欢迎点赞、关注公众号「一灰灰Blog」 我们下章见

---

微信公众号: 一灰灰Blog

