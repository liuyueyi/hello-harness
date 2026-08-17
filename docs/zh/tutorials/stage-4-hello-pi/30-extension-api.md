---
title: "30 · Extension API"
description: "设计 Extension 接口：name + setup(ctx)，配 ExtensionRegistry 插座与 ExtensionContext（name + log）。扩展层住在 Core 之外、只依赖 Core，CLI 增加 --extensions 查看扩展清单。"
gitTag: "v30-extension"
stage: 4
---

# 30 · Extension API

> <span class="stage-badge">Stage Hello Pi</span> · <span class="tag-badge">v30-extension</span>

第二十九章，我们把 `src/` 从平铺重构成了「有边界的 Core」：Model / Runtime / Context / Tool / Event / Session 六件套住进 `src/core/`，其余能力留在外面，`core/index.ts` 是唯一公共出口。边界有了，demo 也证明了「只用 Core 也能跑」。

但收工的时候，作为一个勤于思考的老同学，心里还是会有点疑问的：

> **边界是画出来了，可它是一堵「只进不出」的墙。** 这堵墙挡住了「坏东西」，可也挡住了「好东西」——下一章说「Skill 要长在外面」，它长在哪？怎么挂上去？Core 之外有没有一个「插座」，让新能力能插进来？

这一章，我们就给这堵墙开一个口子——**Extension API**：一个 `name + setup(ctx)` 的极简接口，加上装它的插座（`ExtensionRegistry`）。这是 Pi 思想的第二块拼图：**Minimal Core + Extension First**。接下来进入正题。

## 一、上一版存在什么问题？

一般来讲，墙立起来了，要是没有门，那墙就只能看、不能用。ch29 立了原则，但也留下三个具体问题：

1. **「长在 Core 之外」只是一句口号**：ch29 说 Skill、权限、TUI 以后都要长在 Core 外面——**但外面没有「挂点」**。工具还好说，直接 `registry.register(...)`；可提示词、Skill、Hook 这些不是 Tool 的东西，往哪挂？
2. **新能力必须改 `cli/index.ts`**：加一个工具，改一行 `createAgent`；加一个提示词，改一行 `SYSTEM_PROMPT`；加一个 Hook，改一行 `AgentRuntime`——**每加一个能力都要动产品壳**，这正是 ch29 想消灭的「加能力动骨架」；
3. **「外圈」只是一个位置，不是一个机制**：`tools/`、`workspace/`、`session/`、`providers/` 平铺在 Core 之外，彼此没有契约——**我们有的是「一堆目录」，缺的是「一种统一的能力形态」**。

> 一句话：**ch29 立起了「核心边界」，但还没打开「能力入口」。** Core 外面没有插座，一切能力依然只能「写死」在代码里。说白了就是个只进不出的死胡同 😂

## 二、本篇解决什么问题？

问题已经清晰，既然是外圈只有位置没有机制，那怎么让「能力外置」真的落地呢？接下来看下这一章的具体实现措施，一共就四件事：

1. **定义扩展的统一形态**：`Extension = name + setup(ctx)`——任何能力（工具、Hook、提示词、Skill……）都以这个形态存在；
2. **打开插座**：新增 `ExtensionRegistry`，负责校验、安装、登记扩展——**「装扩展」和「改代码」从此是两件事**；
3. **立起「扩展身份」**：`ExtensionContext` 给每个扩展一个名字、一个说话的地方（`log`）——扩展既知道自己是谁，又能被 harness 观察到；
4. **把插座装进产品**：CLI 增加 `hello --extensions` 打印已安装扩展清单，并立起 `hello-coding` 这个「占位扩展」——它此刻只有身份，工具和 prompt 将在 ch31 / ch33 迁入。

核心心智模型：

> **Core 是墙，Extension 是墙上的门，`ExtensionRegistry` 是门框。** 门框负责「门怎么安、安几扇、门牌号不能重」；门本身（扩展）只回答两个问题：**你叫什么名字，装好后你要做什么。**

这一章把线串一下：**上一版「外圈只是位置、没有挂点、加能力必改壳」这些遗留问题 → 这一章用「Extension 形态 + ExtensionRegistry 插座」解决 → 接下来看一个扩展怎么从定义到安装、再到被 harness 点名道姓。**

## 三、先看最终效果

先跑 demo（无需 API Key，下面是标准的使用姿势）：

```bash
$ node --import tsx examples/stage-4/30-extension-api/demo.mts
```

输出结果如下：

```text
=== 30 · Extension API：让能力在 Core 之外生长 ===

=== 1. 编写扩展（defineExtension） ===
已定义 2 个扩展：hello-hello、status（每个都只有 name + setup）

=== 2. 安装到 ExtensionRegistry ===
[ext:hello-hello] 你好，我是 hello-hello，已挂载到 harness
[ext:status] status：扩展名「status」安装成功，setup 已执行一次
install() 完成：2 个扩展进入 active，setup 各执行恰好一次

=== 3. 扩展清单（manifest） ===
  hello-hello@0.1.0 (active) — 打招呼：安装时向 harness 报到
  status@0.2.0 (active) — 报告一次安装信息

=== 4. 边界校验：install() 的三道闸门 ===
  install(status) 重复安装      → 拒绝：扩展 status 已注册
  install({ name: "" }) 空名    → 拒绝：扩展名不能为空
  install(helloHello) 重复安装  → 拒绝：扩展 hello-hello 已注册
清单仍然只有 2 个扩展——被拒绝的 install 不留下任何痕迹。
```

注意两个信息（**重点关注**这两点）：

1. **setup 恰好执行一次**：`[ext:hello-hello]`、`[ext:status]` 各出现一次——**安装即执行、且只执行一次**；
2. **安装是受控的**：重名、空名、重复安装全部被 `install()` 拒绝，且**被拒绝的安装不留下任何痕迹**。

再看产品壳——CLI 现在能回答「这个 harness 装了哪些扩展」（实测结果如下）：

```bash
$ hello --extensions
```

```text
Workspace: ...
已安装扩展（manifest）：
  hello-coding@0.3.0 (active) — Coding Agent 本体：工具四件套（read/write/edit/bash）+ 方法论 prompt。本章只立身份，工具与 prompt 分别于 ch31 / ch33 迁入。
```

> 这就是这一章的兑现：**「能力可以在 Core 之外生长」第一次有了字面的、可运行的形式。** 扩展长什么样、怎么装、装了什么，全部可观察。然后就可以愉快的接着玩了。

## 四、架构变化

这一章的架构变化：**新增一个「扩展层」，它住在 Core 之外、且只依赖 Core。**

```text
src/
  core/               ← Core：六件套（ch29 收紧）
  extensions/         ← 新增：扩展层
    extension.ts       ← 扩展契约：Extension / ExtensionContext / defineExtension
    registry.ts        ← 插座：ExtensionRegistry（校验 · 安装 · 登记）
    index.ts           ← 扩展层的「名片」，镜像 core/index.ts
  providers/          ← Model 的具体实现（ch29）
  tools/              ← 具体工具（尚未迁入扩展，ch31）
  workspace/  session/  cli/   ← 其余外圈
```

依赖方向是关键（**请注意**这一条，是这一章的含金量所在）：

```text
  extensions ──→ core（只 import core/errors，用 RuntimeError 报错）
  core        ──↗ 不看 extensions 一眼
```

**Core 对扩展一无所知**——这就是边界的含金量：Core 不 import 扩展，扩展反过来 import Core。将来删掉整个 `extensions/` 目录，Core 一行都不用改（**最基本的**，手动加强语气，删外圈不动骨架）。

归属表：

| 新文件 | 归属 | 一句话理由 |
| --- | --- | --- |
| `extensions/extension.ts` | 外圈 | 扩展的「形态」：`name + setup(ctx)`——能力外置的载体 |
| `extensions/registry.ts` | 外圈 | 装扩展的插座：校验、安装、登记——它是机制，不是核心抽象 |
| `extensions/index.ts` | 外圈 | 扩展层的公共出口，沿用 `core/index.ts` 的「名片」习惯 |

> 为什么 `ExtensionRegistry` 不放进 `src/core/`？**因为「扩展」这个名字本身就是「核心之外」的意思。** 把它放进 Core，等于在 Core 里开了一扇通往自己的门——自相矛盾。放在外圈，它还顺手证明了「外圈能力可以 import Core，而 Core 依然『外圈未知』」。骚操作谈不上，但这步棋走得很稳。

## 五、核心抽象

这一章的核心抽象只有一个：**Extension 契约**。它由三块拼成（接下来逐一拆开看）。

### 1. 扩展的形态：`Extension`

```ts
interface Extension {
  name: string;            // 门牌号：全局唯一，安装时校验
  version?: string;        // 版本：先声明，后验证（ch38 Package 再收紧）
  description?: string;    // 一句话说明：进 manifest，给人看
  setup(ctx: ExtensionContext): void;   // 安装时恰好执行一次
}
```

**名字是身份，setup 是行为。** 一个扩展是什么、能干什么，看这两样就够。

### 2. 扩展的视野：`ExtensionContext`

```ts
interface ExtensionContext {
  readonly name: string;      // 我是谁（安装时注入）
  log(message: string): void; // 我说话的地方（转发到 harness 的观察出口）
}
```

ch30 的 `ctx` 只有两个成员——**身份 + 观察口**。这不是抠门，是刻意的节奏：

> **`ExtensionContext` 每章长大一点。** ch30 只给身份和 log；ch31 给它塞进 `ctx.tools`（注册 Tool）；ch32 给它塞进 Hook 挂点；ch33 再给它 prompt。**每章只加一个能力，读者跟得住，Core 也守得住。**

### 3. 装的插座：`ExtensionRegistry`

```ts
class ExtensionRegistry {
  install(extension: Extension): void;   // 三道闸门：非空 · 唯一 · setup 恰好一次
  get(name: string): Extension | undefined;
  list(): InstalledExtension[];          // manifest：name / version / description / status
}
```

三道闸门是「受控可变更」的最小版本——先写进 `install()`，将来 ch37 的 Permission Gate、ch66 的 Harness Mutation 都是它的亲戚。

## 六、实现代码

先交代一句（**不赘述**大体结构）：**这一章「新代码」只有 3 个小文件 + 几行 CLI 接线**，逻辑全部是「校验 + 登记」，没有任何魔法。

### `src/extensions/extension.ts`（完整）

下面给出完整实现：

```ts
export interface ExtensionContext {
  readonly name: string;
  log(message: string): void;
}

export interface Extension {
  name: string;
  version?: string;
  description?: string;
  setup(ctx: ExtensionContext): void;
}

export function defineExtension(extension: Extension): Extension {
  return extension;
}
```

`defineExtension` 是纯「类型友好」的糖：它什么都不做，只是让作者在写扩展时有完整的类型推导（ch31 的 `export default defineExtension({...})` 就是靠它）。**先教学后抽象**——等扩展变成独立包（ch38），它才需要真正干活。

### `src/extensions/registry.ts`（完整）

```ts
import { RuntimeError } from "../core/errors/errors";
import type { Extension } from "./extension";

export interface InstalledExtension {
  name: string;
  version?: string;
  description?: string;
  status: "active";
}

export interface ExtensionRegistryOptions {
  log?: (name: string, message: string) => void;
}

export class ExtensionRegistry {
  private readonly extensions = new Map<string, Extension>();
  private readonly log: (name: string, message: string) => void;

  constructor(options: ExtensionRegistryOptions = {}) {
    this.log = options.log ?? ((name, message) => console.log(`[ext:${name}] ${message}`));
  }

  install(extension: Extension): void {
    const name = extension.name;
    if (typeof name !== "string" || name.trim() === "") {
      throw new RuntimeError("扩展名不能为空");
    }
    if (this.extensions.has(name)) {
      throw new RuntimeError(`扩展 ${name} 已注册`);
    }
    extension.setup({ name, log: (message) => this.log(name, message) });
    this.extensions.set(name, extension);
  }

  get(name: string): Extension | undefined {
    return this.extensions.get(name);
  }

  list(): InstalledExtension[] {
    return [...this.extensions.values()].map((extension) => ({
      name: extension.name,
      version: extension.version,
      description: extension.description,
      status: "active",
    }));
  }
}
```

三个细节值得点名（**重点关注**这三点）：

1. **错误用 `RuntimeError`**：扩展装错了，是 harness 组装期的错误，不是模型错误、也不是工具错误——`kind: "runtime"` 语义最贴；
2. **`log` 可注入**：默认打到 console，CLI 里可以传 no-op 让扩展安静安装——**观察出口可配置，而不是写死**；
3. **顺序敏感**：先校验、再 setup、最后登记。如果 setup 抛异常，扩展不会进入 `extensions` Map——**半装的扩展不存在**。

### CLI 接线（`src/cli/index.ts`）

`createAgent` 里多建一个 `ExtensionRegistry`，装一个占位扩展 `hello-coding`：

```ts
const helloCoding = defineExtension({
  name: "hello-coding",
  version: "0.3.0",
  description: "Coding Agent 本体：工具四件套（read/write/edit/bash）+ 方法论 prompt。本章只立身份，工具与 prompt 分别于 ch31 / ch33 迁入。",
  setup() {},
});
```

然后加一个 `--extensions` 分支，打印 manifest：

```ts
if (args.extensions) {
  console.log("已安装扩展（manifest）：");
  for (const ext of extensions.list()) {
    console.log(`  ${ext.name}@${ext.version ?? "-"} (${ext.status}) — ${ext.description ?? ""}`);
  }
  return;
}
```

**为什么 `hello-coding` 的 setup 是空的？** 因为 ch30 的 `ctx` 还只有身份和 log——**工具注册（ch31）和 prompt（ch33）就是从这个「空壳」长出来的**。先立门框，再安门。这就是最实在的接入姿势：不一步到位，但每步都站得住。

## 七、运行 Demo

**跑法一：扩展生命周期演示（本章主角，无需 API Key）**：

```bash
$ node --import tsx examples/stage-4/30-extension-api/demo.mts
```

即第三节那四段输出：编写 → 安装 → manifest → 边界校验。

**跑法二：看产品壳装了哪些扩展**：

```bash
$ node --import tsx src/cli/index.ts --extensions
```

**跑法三：老姿势全保留——Coding Agent 一条都不破**（需要 `.env`）：

```bash
$ pnpm dev -- "帮我修复这个项目"
$ pnpm dev -- --chat
```

扩展层是「只加不改」：工具注册、会话、resume 的代码一行没动，`hello` 还是那个 `hello`。

> 复测验证的小伙伴，重点观察以下关键证据（**最基本的**，手动加强语气，这几条建议逐条核一遍）：

| 观察点 | 期望 | 实测 |
| --- | --- | --- |
| setup 恰好一次 | 每个扩展的 log 只出现一次 | `[ext:hello-hello]` / `[ext:status]` 各一次 ✓ |
| manifest | 2 个 active 扩展，带版本与描述 | `hello-hello@0.1.0` / `status@0.2.0` ✓ |
| 重名拒绝 | 抛出 `RuntimeError`，清单不变 | `扩展 status 已注册` ✓ |
| 空名拒绝 | 抛出 `RuntimeError` | `扩展名不能为空` ✓ |
| 老 CLI 不破 | `pnpm typecheck` 零报错 | ✓ |
| 产品可见 | `--extensions` 打印清单 | `hello-coding@0.3.0 (active)` ✓ |

## 八、新架构解决了什么？

- **「能力外置」从口号变成机制**：任何能力都以 `Extension` 形态存在、通过 `ExtensionRegistry` 安装——**不再需要为每个能力改 `cli/index.ts`**；
- **Core 的边界得到正反馈**：`extensions/` import Core、Core 不认识 extensions——**边界不是画出来自我安慰的，是能被依赖方向证明的**；
- **受控安装落地**：三道闸门（非空 / 唯一 / setup 一次）是最小的「受控变更」——**乱装的扩展根本进不来**；
- **可观察性提前到位**：`ctx.log` 让扩展的安装过程可见，`--extensions` 让已装清单可见——**扩展不是黑盒，是可以点名道姓的**；
- **产品有了「能力清单」**：`hello --extensions` 是 manifest 的第一个消费者——将来 Skill、Prompt、Theme 都能登记成扩展，一份清单看全家。

## 九、它又引入了什么问题？

接下来再泼盆冷水，看看这个插座还留了哪些坑：

1. **`ctx` 太空，setup 无事可做**：ch30 的扩展只能报个到、喊个话——**真正的价值（注册工具、挂 Hook）要等 ctx 长大**，这就是 ch31 / ch32 的由来；
2. **`setup` 是同步的**：装一个扩展要等它 `await` 点什么（比如读文件、建索引）就办不到——**异步安装**要么等 ch32 的 Hook 机制、要么等 ch38 的独立包；
3. **扩展没有卸载 / 禁用**：装进去就是 `active`，没有 `disable` / `uninstall`——**生命周期只有一半**；
4. **错误只用一个 `RuntimeError`**：装错、装重、装挂全用一个 kind——**报错够用，但不够分诊**，等扩展能做更多事，也许需要更细的错误语义；
5. **加载还是「写死在代码里」**：`createAgent` 里 `install(helloCoding)` 是硬编码——**扩展还不能从磁盘发现、加载**，那是 ch35 Skill Loader / ch38 Package 的活。

## 十、下一章

插座有了，门框立好了——但空壳扩展除了报到，什么都干不了。小伙伴自然会问：**扩展到底能往 harness 里塞什么？**

下一章，我们让 `ctx` 长大第一个能力：**`ctx.tools`**——用扩展注册 Tool。我们会把 ch30 留的 `hello-coding` 空壳真正填起来，让 `read / write / edit / bash` 从「写死在 `createAgent`」变成「由扩展登记」——能力外置的第一块真骨头，Pi 思想的第三块拼图。

> **Minimal Core + Extension First：这一章开了门，下一章把工具搬出门外。**


上面这些就是 Extension API 的基本使用姿势了，有啥用、怎么接着玩 `ctx.tools`，留在下一篇逐一展开。

尽信书则不如，以上内容纯属一家之言，因个人能力有限，难免有疏漏和错误之处，如发现 bug 或者有更好的建议，欢迎批评指正，不吝感激 🙃

欢迎点赞、关注公众号「一灰灰Blog」 我们下章见

---

微信公众号: 一灰灰Blog
