---
title: "25 · CLI"
description: "把仓库变成产品：hello 一条命令打开任意项目目录并运行 Coding Agent。从 pnpm dev -- --tools ... 收敛成人话入口。"
gitTag: "v25-cli"
stage: 3
---

# 25 · CLI

> <span class="stage-badge">Stage Hello Coding Agent</span> · <span class="tag-badge">v25-cli</span>

第二十四章，我们给 Coding Agent 立了干活的方法论——`SYSTEM_PROMPT` 里写着「先观察、再修改、修改后验证、不要猜文件内容」，真实转录里它先 read 看清 bug、再 edit 精准修复、最后 bash 跑出 `factorial(5) = 120` 才交差。

可兄弟们，章法有了，**入口还是个「库」和「脚本」**。想让它干一件事，你得敲这么一长串：

```bash
node --import tsx --env-file-if-exists=.env src/cli/index.ts --tools "帮我修复这个项目"
```

或者至少记着 `pnpm dev -- --tools ...` 这一坨参数。这不像一个**产品**，更像一个**实验装置**。这一章，我们把 Coding Agent 套上一个**人话入口的壳**：`hello "帮我修复这个项目"`。

<!-- more -->

## 一、上一版存在什么问题？

回看 ch19–24，我们的 Agent 是这样被启动的：

1. **入口是 `pnpm dev -- --tools ...`，参数多、记不住**：要打开工具模式得记 `--tools`，问题得跟在一堆 flag 后面。**这像给命令行老兵用的调试器，不像给人用的产品**；
2. **workspace 写死 `process.cwd()`**：`createAgent` 内部固定用当前目录当根，**没法打开「别的项目」**——想修 `examples/stage-3/25-cli` 里的 bug，你得先 `cd` 进去，还得祈祷那个目录恰好有 `.env`；
3. **模式靠一堆 flag 隐式区分**：`--stream` / `--full` / `--tools` / `--chat` 全平铺在入口，**没有一个「默认就会干活」的姿势**；
4. **没有帮助信息**：敲错参数只能看报错，**没有 `--help` 告诉你这个命令能干嘛**；
5. **产品缺一个名字**：整套东西叫 `hello-harness`，但**没有一个叫 `hello` 的命令**——名字和入口对不上。

> 一句话：**这一版是「能跑的库」，不是「能用的产品」——入口参数又长又难记，workspace 打不开指定项目，还没有名字和帮助。**

## 二、本篇解决什么问题？

1. **收敛成人话入口**：新增 `hello` 命令——`hello "帮我修复这个项目"`，**默认就是工具模式（Coding Agent）**，不用记 `--tools`；
2. **打开指定项目**：新增 `--dir <路径>`，**workspace 根目录从「写死 cwd」变成「按参数创建」**，一条命令修任意项目；
3. **补上帮助与模式说明**：新增 `--help`，把全部模式、参数、示例**一次讲清楚**；
4. **保留向后兼容**：`pnpm dev` 的 `--stream` / `--full` / `--tools` / `--chat` **全部原样保留**——老读者、老 demo 一条命令都不破坏；
5. **名字与产品对上**：`package.json` 注册 `bin.hello`，**`hello` 就是这套产品对外的那张脸**。

核心心智模型：

> **CLI 是 Harness 的产品壳。Model / Tool / Runtime 决定了 Agent「能做到什么」，CLI 决定了用户「怎么舒服地用上它」——能力是引擎，CLI 是方向盘。**

解决完上面五件事，把线串一下：**上一版「入口难记、打不开指定项目、没有名字和帮助」这些遗留问题 → 这一章用「hello 命令 + --dir + --help」解决 → 接下来看一条人话命令怎么把项目修好。**

### 解决之后，我们收获了什么？

- **一句话启动 Coding Agent**：`hello "帮我修复这个项目"`——**不用记 flag、不用记 loader、不用记路径**，默认就在当前目录用工具模式干活；
- **一条命令修任意项目**：`hello --dir <项目> "..."`——**workspace 从写死 cwd 变成参数化**，想修哪个项目就指向哪个；
- **入口有了说明书**：`hello --help` 一次讲清所有模式与参数——**工具该有它自己的使用说明**；
- **产品有了名字和脸**：`package.json` 的 `bin.hello` 让 `hello` 成为对外命令——**「Hello Harness」的 Hello，终于有了呼应**；
- **老姿势全部保留**：`pnpm dev` 的四种模式一个不少——**演进不破坏已写好的教程 demo**。

> 一句话收个尾：遗留的「入口难记、workspace 写死、没有名字和帮助」问题被这一章的 `hello` 命令解决掉，换来的则是「一句话、任意项目、有说明书」的产品入口。

## 三、先看最终效果

准备好一个**带 bug 的小项目**（`examples/stage-3/25-cli/`）——一个干净的、有 `package.json`、有测试的小工程，`src/calc.mjs` 里的 `factorial` 有 bug：

```js
export function factorial(n) {
  if (n <= 1) return 1;
  return n * factorial(n - 2);   // bug：应该是 n - 1
}
```

```jsonc
// test/calc.test.mjs（node:test）
test("factorial(5) === 120", () => {
  assert.equal(factorial(5), 120);   // 当前失败：factorial(5) 实际是 15
});
```

现在，**一条人话命令**（不用先 `cd`、不用记 `--tools`、不用记 loader）：

```bash
$ hello --dir examples/stage-3/25-cli "帮我修复这个项目里的 bug：src/calc.mjs 的 factorial 函数结果不对，请先观察、再修改、最后运行 npm test 验证"
```

真实的转录如下——**先观察 → 再修改 → 修改后验证**一气呵成，`Workspace` 直接指向你指定的项目：

```text
Workspace: D:\Workspace\hui\project\hello-harness\examples\stage-3\25-cli
[run:start ] Input  : 帮我修复这个项目里的 bug：src/calc.mjs 的 factorial 函数结果不对...
Step 1 · model  → 调用工具：bash, read
[tool:start] bash({"command":"dir /s /b src\\"})     ← 先观察：看目录结构
[tool:start] read({"path":"src/calc.mjs"})            ← 再观察：读真实内容
Step 4 · model  → 调用工具：read
[tool:start] read({"path":"package.json"})            ← 观察：确认 npm test 怎么跑
Step 6 · model  → 调用工具：edit
[tool:start] edit({"oldString":"n - 2","newString":"n - 1"})   ← 再修改：精准替换
Step 8 · model  → 调用工具：bash
[tool:start] bash({"command":"npm test"})             ← 修改后验证：跑测试
[tool:end  ] → "✔ add(2, 3) === 5   ✔ factorial(5) === 120   ✔ factorial(0) === 1   pass 3 / fail 0" · exitCode 0
Step 10 · model  → 完成回答
Answer  : 全部通过 ✅ Bug 原因：factorial 递归调用时传的 n - 2，导致跳数计算（如 5! 得到 5×3×1=15）。
          修正为 n - 1 后恢复正常，3 个测试均通过。
Steps   : 5 轮 · 12 条消息 · 11 步 · 12458ms
```

请各位小伙伴注意几个细节：

- **`Workspace:` 一行**：启动时打印了 workspace 根目录——**一眼确认 Agent 在哪个项目上干活**，这是 ch23 Workspace 在 CLI 层第一次「显形」；
- **没有 `--tools`、没有 loader**：`hello` 默认就是工具模式，**方法论（ch24）和工具（ch19–23）全部在线**；
- **`npm test` 通过**：这次验证用的是**项目自己的测试脚本**（`node:test`）——比 ch24 的 `node src/math.mjs` 更进一步，**Agent 读懂了 `package.json` 里的 `npm test`，用标准方式验证**；
- **`--dir` 生效**：Agent 的 cwd 和 workspace 都指向 `25-cli` 这个项目——**一条命令打开指定项目**。

对比 ch24 的「先 cd 进示例目录再敲一长串」，这一章的入口短到不能再短——**能力没变，入口从「调试器」变成了「产品」**。

## 四、架构变化

```text
src/
├── model/            # Model 层（不变）
├── agent/            # Agent 核心（不变）
├── workspace/        # ch23：Workspace（不变）
├── tools/            # 工具层（不变：read / write / edit / bash / calculator / random）
├── context/          # 上下文（不变）
├── events/           # 事件（不变）
├── errors/           # 错误（不变）
└── cli/
    ├── index.ts      # 重构：createAgent(dir) 按参数建 workspace/registry，新增 --dir/--help
    ├── chat.ts       # 多轮对话（不变）
    └── render.ts     # 事件渲染（不变）

bin/
└── hello.mjs         # 新增：真正的 hello 命令（注册 tsx loader + 加载 .env + 默认 --tools）

package.json          # 新增 bin.hello 与 hello script
examples/
└── stage-3/
    └── 25-cli/       # 新增：带 bug 的演示项目（package.json + src/calc.mjs + test）
```

**关键变化只有三处**，而且都很小：

1. **`src/cli/index.ts`**：workspace/registry 从「模块顶层写死 cwd」挪进 `createAgent(dir)` 函数——**根目录参数化**；`parseArgs` 加 `--dir` / `--help`；`runAgentDemo` 显式接收 `registry`；
2. **`bin/hello.mjs`**：真正的 `hello` 命令——**一个 15 行的启动器**：注册 tsx loader、加载 `.env`、默认补 `--tools`，然后把剩下的参数原样交给 `src/cli/index.ts`；
3. **`package.json`**：注册 `bin.hello` 和 `hello` script——**`hello` 成为产品的对外命令**。

架构演进叙事：

```mermaid
flowchart LR
    A[ch19-24<br/>工具 + Workspace + 方法论] --> B[ch25<br/>CLI 产品壳]
    B --> C[hello 命令<br/>bin/hello.mjs]
    B --> D[--dir 参数<br/>createAgent(dir)]
    B --> E[--help<br/>用法说明书]
    C --> F[src/cli/index.ts<br/>createAgent + parseArgs]
```

一句话：前几章给 Agent 装好了「手」「腿」和「脑」，这一章给整套东西装上了「**方向盘和外壳**」——`hello` 一词启动。

## 五、核心抽象

在甩代码之前，依然先讲设计思考——核心依然是「先钉需求、再拆角色、最后克制边界」三步：

1. **钉需求**：用户想「让 Agent 修我的项目」，他不想记 loader、不想记 flag、不想先 cd。需求就一句：**`hello <一句话> [--dir 项目]`**；
2. **拆角色**：启动链路拆成三块，各管一段——**`bin/hello.mjs`（启动器：把 TS 环境准备好、默认进工具模式）、`createAgent(dir)`（装配器：按目录建 workspace 和 registry）、`parseArgs`（翻译官：把命令行参数变成配置）**；
3. **克制边界**：**不在 CLI 里加业务逻辑**（修 bug 是 Agent 的事，不是 CLI 的事）、**不重复造参数解析库**（手写循环足够且可读）、**不做全局状态**（每次调用 `createAgent(dir)` 都是干净的新 Agent）。这一章只做一件事：**把「启动 Agent」包装成一句人话**。

> **出发点小结**：我们不是「为了命令行好看而加 bin」，而是被「入口太长记不住、打不开指定项目、没有帮助」这些真实痛点逼出来的。
> 先把「启动方式」做成产品，让用户一条命令就能干活。

### 三个核心抽象：启动器 / 装配器 / 翻译官

这一章的核心抽象不是某个炫酷的类，而是**一次启动的三层分工**：

| 角色 | 文件 | 职责 | 心智模型 |
| --- | --- | --- | --- |
| **启动器** | `bin/hello.mjs` | 注册 TS loader、加载 `.env`、默认工具模式 | **「点火」**——把 Node 环境变成能跑 TS 的 Agent 环境 |
| **装配器** | `createAgent(dir)` | 按目录建 Workspace 和 ToolRegistry | **「组装」**——每次调用都是一台干净的新 Agent |
| **翻译官** | `parseArgs` | 命令行参数 → 运行配置 | **「传话」**——把用户的一句话变成 Agent 的配置 |

关键设计在于：

- **启动器只管「点火」，不管「配置」**：`bin/hello.mjs` 里没有任何模式判断逻辑，只做三件事——注册 tsx、读 `.env`、如果没给模式就默认 `--tools`，然后**把参数原样转发**给 `index.ts`。这样启动器永远不用改，改业务永远在 `index.ts`；
- **装配器只认「目录」**：`createAgent(dir)` 的参数是**一个目录**，不是 flag、不是模式——「在哪个项目上干活」是 workspace 的事（ch23），CLI 只负责把目录传给它；
- **翻译官只产出「数据」**：`parseArgs` 返回纯对象，没有任何副作用——**同一个参数集合永远产出同一个配置，可测试、可预测**。

### 为什么「默认工具模式」要放在启动器里？

`hello` 命令默认就是 Coding Agent（工具模式），但**老入口 `pnpm dev` 默认还是纯流式**。这两个默认不能打架，所以「默认 `--tools`」被放在 `bin/hello.mjs` 里——**产品入口默认干活，调试入口保留原样**：

```js
const hasMode = args.some((a) => ["--tools", "--chat", "--stream", "--full", "-h", "--help"].includes(a));
if (!hasMode) args.unshift("--tools");   // hello 默认工具模式
```

> 一句话：**「hello 默认是 Coding Agent」是产品决策，放在产品壳里；「pnpm dev 保持原样」是兼容决策，留在调试入口里——两者各归其位，互不污染。**

## 六、实现代码

### 启动器：`bin/hello.mjs`

**新增文件 `bin/hello.mjs`**——真正的 `hello` 命令，一个 15 行的启动器：

```js
#!/usr/bin/env node
import { tsImport } from "tsx/esm/api";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

try {
  process.loadEnvFile();        // 加载 .env（没有就忽略）
} catch {
  // 没有 .env 时忽略
}

const args = process.argv.slice(2);
const hasMode = args.some((a) => ["--tools", "--chat", "--stream", "--full", "-h", "--help"].includes(a));
if (!hasMode) args.unshift("--tools");   // hello 默认工具模式

const entry = path.join(path.dirname(fileURLToPath(import.meta.url)), "../src/cli/index.ts");
process.argv = [process.argv[0], entry, ...args];

await tsImport(pathToFileURL(entry).href, import.meta.url);
```

**重点关注**这几个设计点：

1. **`tsImport` 注册 TS loader**：`tsx/esm/api` 提供 `tsImport`，**让一个普通 `node bin/hello.mjs` 能直接加载 `.ts` 入口**——不需要用户手动加 `--import tsx`；
2. **`process.loadEnvFile()`**：Node 22.9+ 自带加载 `.env`，**API key 从环境变量来，不硬编码**（ch18 的安全约定）；
3. **默认补 `--tools`**：没给任何模式就默认工具模式——**`hello "问题"` 直接是 Coding Agent**；
4. **参数原样转发**：解析完就改 `process.argv` 再 `tsImport` 入口——**启动器不做业务，业务全在 `index.ts`**。

### 装配器与翻译官：`src/cli/index.ts`

**`src/cli/index.ts`**——三个关键改动。

**改动一：workspace/registry 参数化（`createAgent`）**

```ts
function createAgent(dir: string): { workspace: Workspace; registry: ToolRegistry } {
  const workspace = new Workspace(dir);
  const registry = new ToolRegistry();
  registry.register(calculator);
  registry.register(randomInteger);
  registry.register(createReadTool(workspace));
  registry.register(createWriteTool(workspace));
  registry.register(createEditTool(workspace));
  registry.register(createBashTool(workspace));
  return { workspace, registry };
}
```

之前 workspace 在模块顶层 `new Workspace(process.cwd())`，现在**收进函数、按目录创建**——ch23 的 Workspace 第一次成为「每次启动可指定」的装配件。

**改动二：`--dir` / `--help`（`parseArgs`）**

```ts
} else if (arg === "--dir" || arg === "-d") {
  result.dir = args[++i];
} else if (arg === "--help" || arg === "-h") {
  result.help = true;
}
```

`parseArgs` 返回 `dir` 和 `help`，**翻译官新增两个词条**。

**改动三：主流程按参数装配并打印 Workspace**

```ts
async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printUsage();
    return;
  }

  const { workspace, registry } = createAgent(args.dir ?? process.cwd());
  const prompt = args.question ?? "用一句话介绍你自己";
  ...
  if (args.chat) {
    await chat(model, registry, options);
  } else if (args.tools) {
    console.log(`Workspace: ${workspace.root}`);       // ← ch23 Workspace 在 CLI 层显形
    await runAgentDemo(model, registry, request, { ...options, streaming: args.stream });
  } else if (args.full) {
    await runGenerate(model, request);
  } else {
    await runStream(model, request);
  }
}
```

**重点**：`args.dir ?? process.cwd()`——**给了 `--dir` 就用指定项目，没给就在当前目录**；启动工具模式前打印 `Workspace:` 让用户确认干活范围。

### `package.json`：注册命令

```jsonc
"bin": {
  "hello": "bin/hello.mjs"
},
"scripts": {
  "hello": "node bin/hello.mjs",
  "dev": "node --import tsx --env-file-if-exists=.env src/cli/index.ts"
}
```

**`pnpm hello "..."` = 启动器**（默认工具模式），**`pnpm dev -- ...` 原样保留**（四种模式，兼容 ch0–24 所有 demo）。

### 与上一版的对照

| 上一版（ch24） | 这一版（ch25） |
| --- | --- |
| 入口：`pnpm dev -- --tools "..."`，要记 `--tools` | 入口：`hello "..."`，默认工具模式 |
| workspace 写死 `process.cwd()` | workspace 由 `--dir` 参数化 |
| 无帮助信息 | `hello --help` 全量说明书 |
| 无命令名 | `bin.hello`，产品叫 `hello` |
| `pnpm dev` 四种模式 | 全部保留（向后兼容） |

## 七、运行 Demo

**跑法一：修指定项目（真实模型）**——本章的演示，复现第三节转录：

```bash
$ hello --dir examples/stage-3/25-cli "帮我修复这个项目里的 bug：src/calc.mjs 的 factorial 函数结果不对，请先观察、再修改、最后运行 npm test 验证"
```

观察转录验证 `--dir` 与工具模式生效：

| 阶段 | 期望 | 实测转录 |
| --- | --- | --- |
| 启动 | 打印 workspace 根目录 | `Workspace: ...\examples\stage-3\25-cli` |
| 先观察 | 先 bash/read 看现状 | `dir /s /b src\` → `read src/calc.mjs` → `read package.json` |
| 再修改 | 看清后精准修改 | `edit(oldString:"n - 2", newString:"n - 1")` |
| 修改后验证 | 跑项目测试确认 | `bash npm test` → `pass 3 / fail 0` → `exitCode 0` |

**跑法二：当前目录直接干活**——不指定 `--dir`，就在当前目录修：

```bash
$ hello "帮我看看当前目录有什么问题"
```

**跑法三：帮助信息**——不看文档也知道怎么用：

```bash
$ hello --help
```

**跑法四：老姿势兼容性**——ch19–24 的 demo 一条不破：

```bash
$ pnpm dev -- --chat                    # ch19–22 多轮对话
$ pnpm dev -- --tools "问题"            # ch24 工具模式
$ pnpm dev -- "用一句话介绍你自己"        # ch1–4 纯流式
```

> 这一章不做无模型 demo：**产品入口的价值只能靠真实使用体现**——`hello` 一词启动、`--dir` 打开指定项目、`npm test` 通过，全在一次真实转录里。

## 八、新架构解决了什么？

- **产品有了人话入口**：`hello "帮我修复这个项目"`——**一条命令、默认工具模式**，不用记 loader、不用记 flag、不用先 cd；
- **workspace 可指定**：`--dir` 让 workspace 从写死 cwd 变成参数化——**想修哪个项目就指向哪个，Agent 的 cwd 和权限范围都跟着走**（ch23 的 Workspace 终于派上大用场）；
- **命令有了说明书**：`hello --help` 一次讲清模式、参数、示例——**工具该有它自己的使用说明**；
- **产品有了名字**：`bin.hello` 让 `hello` 成为对外命令——**「Hello Harness」终于名副其实**；
- **向后兼容**：`pnpm dev` 四种模式原样保留——**演进不破坏已写好的教程 demo**；
- **装配更清晰**：`createAgent(dir)` 把 workspace + registry 的组装收进一个函数——**以后加新工具、加新能力，只在装配器里加一行**。

## 九、它又引入了什么问题？

入口顺了，可兄弟们，问题也跟着来了——**「能跑」和「能聊」之间，还差着一大截**：

- **还是「一问一答」**：`hello "修复 bug"` 跑完就结束，**Agent 说完就散**——你没法追问「那 `add` 呢？」「为什么这么改？」，**没有上下文延续**，这是 Multi-turn Session（ch26）的战场；
- **workspace 是目录，不是会话**：`--dir` 只是把根目录传进去，**没有「对话历史」「任务状态」这些持久化**——修到一半想停下来明天继续？没门；
- **`hello` 还是「一次性」命令**：每次启动都是 `createAgent(dir)` 的新 Agent——**没有记忆、没有跨命令的状态**，这是 Session / Context 层要解决的；
- **失败不优雅**：真实转录里曾出现一次 `Connection error.`（模型网络抖动），`[run:end] failed` 就结束了——**没有重试策略、没有恢复路径**，这是 Runtime 层要解决的；
- **`--dir` 还是手动指定**：用户得自己记得项目路径——**「打开最近的项目」「自动探测 workspace」**是后续体验优化；
- **一句话，从「会启动」到「会对话」：入口能做的是「启动一次」，但真正的 Coding Agent 需要「持续对话、带状态、可恢复」**——而这正是下一章要解决的：**Multi-turn Session，让 Agent 从「跑完就散」变成「有记忆地聊下去」**。

## 十、下一章

> **本章小结**：这一章给 Coding Agent 套上了产品壳——新增 `hello` 命令（默认工具模式）、`--dir` 打开指定项目、`--help` 帮助信息，并用 `createAgent(dir)` 把 workspace 和 registry 的装配收进一个函数。真实转录里，`hello --dir examples/stage-3/25-cli "帮我修复这个项目里的 bug..."` 一句话启动，Agent 先 `dir` + `read` 观察、再 `edit` 精准修复、最后 `npm test` 全绿。我们立住了一个新的心智模型：**CLI 是 Harness 的产品壳——能力是引擎，CLI 是方向盘，启动器只管点火、装配器只认目录、翻译官只传话。**

**下一章：Multi-turn Session**——入口能启动了，可兄弟们，现在的 Agent 还是「一问一答、跑完就散」：

```text
你 > 帮我修复 factorial 的 bug
Agent > 修好了，npm test 通过 ✅        ← 然后呢？Agent 就结束了
你 > 那再帮我看看 add 有没有问题？
Agent > （一脸茫然：刚才聊了啥？）       ← 没有上下文延续！
```

- 现在的 `hello` 一次启动就是一个新 Agent，**没有对话历史**——Session 要把「上下文」变成 Agent 的长期记忆；
- `--dir` 只是传了个目录，**没有「这个会话在干什么、干到哪了」的状态**——Session 要给每次交互一个身份；
- 想追问、想多轮、想「修完这个再修那个」？**单次 Run 做不到**——Session 才是用户和 Agent 对话的单位。

所以下一章，我们从 Session 开始，把「跑完就散的 Agent」升级成「**有记忆、能追问、带上下文的 Coding Agent**」😊，欢迎点赞、关注公众号「一灰灰Blog」 我们下章见

---

微信公众号: 一灰灰Blog