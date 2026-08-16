---
title: "28 · Resume"
description: "hello --resume <会话id>：从 .sessions/ 读回昨天的一场对话，让 Agent 继续干活。第一次实现「Agent 可以继续昨天的任务」。也是 Stage 3 的收官章——毕业作品总览：Coding Agent 最终长成了什么样、可以怎么用。"
gitTag: "v28-resume"
stage: 3
---

# 28 · Resume

> <span class="stage-badge">Stage Hello Coding Agent</span> · <span class="tag-badge">v28-resume</span>

第二十七章，我们把 Session 写进了磁盘——`.sessions/<id>.json` 里躺着完整的一场对话：system 方法论、每条 user 指令、每次工具调用、每个结果、每轮回答，一字不差。退出 CLI，对话依然存在。

很显然，我们依然是留了一个坑：**文件「躺」着不等于对话「活」着**。

我们有 `SessionStore.load(id)` 能从磁盘读回，可**没有任何命令真的去调用它**——没有 `--resume`，`.sessions/` 只是一堆没人读的 JSON。

所以这一章，我们要在前面的「存」基础上，再来一次「取回来用」：`hello --resume <会话id>`，让 Agent **继续昨天的任务**。接下来进入正题。

<!-- more -->

## 一、上一版存在什么问题？

一般来讲，能存下来的东西，要是没人能取出来，那存它干嘛。回看 [ch27](./27-session-persistence)，遗留的问题其实挺扎心：

1. **能存不能取**：`SessionStore.save()` 每轮自动落盘，但 `load()` 实现完就闲置了——**数据在磁盘上，却没有任何入口把它读回来**；
2. **会话无法续跑**：`hello --chat` 永远是**开一场新对话**——昨天的 15 条消息、修过的 bug、得出的结论，**重新开聊就全部作废**；
3. **用户没法指向一场对话**：即使知道有 `.sessions/`，也没有命令说「**就是这一场，继续**」——续跑的能力存在，续跑的手势不存在；
4. **上下文恢复是 API 而不是产品**：`store.load()` + `new Session(id, messages)` 是库的用法，**小伙伴要的是 `--resume` 一个单词**；
5. **Stage 3 的承诺还差最后一步**：ch26–28 的叙事是「多轮 → 落盘 → 续跑」，**前两步都做了，最后一步「Agent 可以继续昨天的任务」还没兑现**。

> 一句话：**上一版是「建了库却没人查」——`.sessions/` 里躺着完整的对话，但用户没有任何办法说「继续这一场」。持久化到位了，续跑的手势缺席了。** 说白了就是个只进不出的保险箱 😂

## 二、本篇解决什么问题？

那么问题来了：既然上面对话存是存了，取不出来等于白存，那怎么让它真的「回来干活」？接下来看下这一章的具体解决姿势：

1. **新增 `hello --resume <会话id>`**：从 `.sessions/` 读回指定会话，**接着它继续多轮对话**——「继续昨天的任务」成了一句人话命令；
2. **恢复的是整个上下文**：`resume` 不是「记住结论」，而是**把 15 条历史消息原样装回 `AgentContext`**——模型从昨天断掉的地方接着想；
3. **续跑的结果继续落盘**：resume 后的每一轮照常 `store.save()`——**同一个 `<id>.json` 继续生长，从 15 条消息长到 33 条**；
4. **给出清晰的反馈**：启动时打印 `Resumed : <id>（N 条历史消息）`——**小伙伴一眼看到「我确实续上了昨天那场」**；
5. **查无此会话说人话**：`--resume` 一个不存在的 id，报错「**没有找到会话 xxx，请检查 .sessions/ 目录**」——**不是堆栈，是人话**。

核心心智模型：

> **save 是「让对话活过进程」的前提，resume 是「让对话回来干活」的手势。SessionStore 是仓库，--resume 是取货单——「存得下」+「取得出」= 「一场对话真正可跨会话续跑」。**

解决完上面五件事，把线串一下：**上一版「能存不能取、没有续跑入口、resume 缺席」这些遗留问题 → 这一章用「--resume 从磁盘读回会话继续聊」解决 → 接下来看昨天修了一半的 bug，今天一条命令接上。**

### 解决之后，我们收获了什么？

- **一句命令继续昨天**：`hello --resume <id>`——**不用重新解释项目背景，Agent 记得昨天改了什么**；
- **上下文无缝接续**：resume 把完整历史装回上下文——**模型直接「接着昨天的思路」干活，而不是从头猜**；
- **续跑也留痕**：resume 后的对话继续写回**同一个** `.sessions/<id>.json`——**一场对话的完整生命线，从第一天到最后一天都连着**；
- **反馈清晰**：`Resumed : <id>（N 条历史消息）`——**续没续上，一眼便知**；
- **报错友好**：查无此会话时给出可操作的提示——**小伙伴知道去哪找、该检查什么**。

> 一句话收个尾（**最基本的**，手动加强语气）：遗留的「能存不能取、没有续跑手势」问题被这一章的 `--resume` 解决掉，换来的则是「昨天修到一半的 bug，今天一条命令接着修」——Stage 3 的「Coding CLI」承诺，就此闭环。

## 三、先看最终效果

**第一步：昨天**，开一场对话修 `factorial` 的 bug，聊完退出（`exit`）。这一场对话被自动落盘，Session id 是 `16b6b867-57ec-4717-a03b-ed4a94461a33`：

```text
Hello Harness v1.0 · 流式多轮对话（输入 exit 退出，Ctrl+C 取消本轮）
Session : 16b6b867-57ec-4717-a03b-ed4a94461a33
Sessions: D:\Workspace\hui\project\hello-harness\examples\stage-3\25-cli\.sessions

你 > 帮我修复这个项目里的 bug：src/calc.mjs 的 factorial 函数结果不对，请先观察、再修改、最后运行 npm test 验证
Step 1  · model  → 调用工具：read, bash
Step 2  · tool   → read({"path":"src/calc.mjs"}) = "… return n * factorial(n - 2); …"
Step 5  · tool   → bash({"command":"dir /B /S"}) → 看到 src/ test/ 结构
Step 10 · tool   → edit({"path":"src/calc.mjs","oldString":"return n * factorial(n - 2);","newString":"return n * factorial(n - 1);"}) = "已替换 1 处"
Step 12 · tool   → bash({"command":"npm test"}) → pass 3 / fail 0
Step 14 · finish → finished
Status  : completed (finished) · 26517ms

你 > exit
```

磁盘上的 `.sessions/16b6b867-….json` 此时有 **15 条消息**。

**第二步：今天**，不再重新开聊，而是 `--resume` 那场对话，直接让它加功能：

```bash
$ hello --dir examples/stage-3/25-cli --resume 16b6b867-57ec-4717-a03b-ed4a94461a33
```

真实转录如下——注意启动行变成了 `Resumed`（实测结果）：

```text
Hello Harness v1.0 · 流式多轮对话（输入 exit 退出，Ctrl+C 取消本轮）
Resumed : 16b6b867-57ec-4717-a03b-ed4a94461a33（15 条历史消息）
Sessions: D:\Workspace\hui\project\hello-harness\examples\stage-3\25-cli\.sessions

你 > 很好，继续：现在再帮我加一个 divide 函数，并补充一条测试
Step 1  · model  → 调用工具：edit    ← 第一刀就是 edit，因为它记得昨天把 factorial 改成了 n - 1
Step 2  · tool   → edit({"path":"src/calc.mjs","oldString":"export function factorial(n) {… return n * factorial(n - 1); …}"}) = [tool] 未找到 oldString（CRLF 换行）
Step 3  · model  → 调用工具：read     ← 方法论：没匹配上？重读文件确认现状
Step 5  · model  → 调用工具：edit     ← 再试（还是 CRLF 问题）
Step 9  · model  → 调用工具：write    ← 换策略：整文件重写，一步到位
Step 10 · tool   → write({"path":"src/calc.mjs","content":"… export function divide(a, b) { if (b === 0) throw … }"}) = "已写入"
Step 13 · model  → 调用工具：write    ← 测试文件同理
Step 15 · tool   → bash({"command":"npm test"}) → pass 6 / fail 0
Step 17 · model  → 完成回答
Status  : completed (finished) · 29870ms

你 > exit
```

这场续聊结束，同一个 `.sessions/16b6b867-….json` 长到了 **33 条消息**——**昨天 15 条 + 今天 18 条，一条对话线连着**。

> 注意第二步的第一刀：模型**没有**先 `bash` 列目录、**没有**问用户「这个项目是什么」、**没有**重新读一遍项目背景——它**直接对昨天改过的 `factorial(n - 1)` 下手 edit**。这就是「继续昨天的任务」的实感（**请重点关注**）：**不是从零开始，是从断点继续。**

## 四、架构变化

这一章几乎没有新增架构——`SessionStore.load()` ch27 就写好了，本章只是**把它接上 CLI 的手势**：

```text
hello --resume <id>
        │
        ▼
chat() ── createOrResumeSession(store, systemPrompt, resumeId)
        │                            │
        │                     ┌──────┴──────┐
        │                     ▼             ▼
        │              store.load(id)   new Session(id, messages)
        │              （读回 15 条）     （原样装回上下文）
        ▼
     继续多轮循环（每轮照常 save，同一个 <id>.json 继续生长）
```

**关键点**：resume 和新建对话**共享同一个 `chat()` 循环**——差别只在开头：**没有 resumeId 就开新会话，有 resumeId 就从磁盘载入旧会话**。载入之后，turn / save / summary 全部复用，零额外逻辑（**额外说一句**：没新轮子就是最好的轮子）。

目录变化只有两处小改：

```text
src/
  cli/
    chat.ts     # + createOrResumeSession()：新建 vs 载入的分支
    index.ts    # + --resume 参数解析、用法说明、dispatch
```

## 五、核心抽象

这一章**没有新增核心抽象**——核心是 ch26 的 `Session` 和 ch27 的 `SessionStore`。本章新增的是一个**组合动作**（这一块不赘述了，重点在分支思路）：

```ts
// 建会话 vs 续会话，一个分支搞定
function createOrResumeSession(store, systemPrompt, resumeId?): Session {
  if (!resumeId) {
    return new Session(undefined, [systemMessage(systemPrompt)]);   // 新建：播种 system prompt
  }
  const record = await store.load(resumeId);                        // 续跑：从磁盘读回
  if (!record) throw new Error(`没有找到会话 ${resumeId}，请检查 .sessions/ 目录`);
  return new Session(record.id, [...record.context.messages]);      // 原样装回
}
```

三个要点（**重点关注**这三点）：

1. **载入 = 构造函数的另一条路**：`new Session(id, messages)` 既能用于「从零开始」也能用于「从磁盘恢复」——**同一个类，两种出生方式**；
2. **id 保持不变**：恢复时用 `record.id` 而不是重新随机——**续跑的仍是「那一场」对话，同一个文件继续写**；
3. **resume 是 chat 的一个开关**：不加新模式、不加新循环——**`args.resume` 存在就走载入分支，否则照旧**——**最小改动接入已有产品**。

> **为什么要这样设计？** 因为「续跑」不是新能力，而是「Session 的另一种构造方式」——**上下文类、存储类都没有变，变的是 CLI 的入口参数**。最小、可读、不重复。骚操作没啥可炫的，朴素的道理一条。

## 六、实现代码

### `src/cli/chat.ts`：新建 vs 载入

`chat()` 新增可选参数 `resumeId`，开头分流（完整片段如下）：

```ts
export async function chat(
  model: Model,
  registry: ToolRegistry,
  systemPrompt: string,
  workspace: Workspace,
  options: AgentRuntimeOptions,
  resumeId?: string,                    // ← 新增：有值就续跑
): Promise<void> {
  const runtime = new AgentRuntime(model, registry, { ...options, streaming: true });
  const store = new SessionStore(workspace);
  const session = await createOrResumeSession(store, systemPrompt, resumeId);
  const state: DisplayState = { stepCount: 0, retryCount: 0 };
  // …事件订阅、输入循环完全不变…
  // …每轮照常：await store.save(session.snapshot());
}
```

载入与横幅打印：

```ts
async function createOrResumeSession(
  store: SessionStore,
  systemPrompt: string,
  resumeId?: string,
): Promise<Session> {
  if (!resumeId) {
    return new Session(undefined, [systemMessage(systemPrompt)]);
  }
  const record = await store.load(resumeId);
  if (!record) {
    throw new Error(`没有找到会话 ${resumeId}，请检查 .sessions/ 目录`);
  }
  return new Session(record.id, [...record.context.messages]);
}

// 启动横幅：区分「新建」和「续跑」
if (resumeId) {
  console.log(`Resumed : ${session.id}（${session.context.messages.length} 条历史消息）`);
} else {
  console.log(`Session : ${session.id}`);
}
```

**重点**：`store.load(id)` 返回 `null`（查无此会话）时**直接抛错**——`main().catch` 会把它打印成人话并 `exit 1`。**「查无此会话」是业务状态，用清晰的错误表达，而不是让小伙伴看到空对话发懵。**

### `src/cli/index.ts`：参数解析与 dispatch

下面给出参数解析与派发的完整片段：

```ts
// ① 参数结构加字段
interface CliArgs {
  …
  resume?: string;
}

// ② 解析 --resume <id>
} else if (arg === "--resume") {
  result.resume = args[++i];

// ③ dispatch：chat 或 resume 都走同一个 chat()
if (args.chat || args.resume) {
  await chat(model, registry, SYSTEM_PROMPT, workspace, options, args.resume);
}

// ④ 用法说明
hello --resume <会话id>                    继续一场历史会话
--resume <id>            继续历史会话（从 .sessions/ 载入）
```

**重点**：`args.chat || args.resume`——**`--resume` 隐含「多轮对话模式」**，用户不用既 `--resume` 又 `--chat`。一个 flag 完成「载入 + 开聊」两件事。这就是最实在的使用姿势：不刻意，但稳。

## 七、运行 Demo

**跑法一：续跑昨天修了一半的任务（本章的演示，复现第三节转录）**。

先跑一次对话，让我们持久化一次session，同样的，还是来修 `examples/stage-3/25-cli/src/calc.mjs` (这是个老演员了😄)

```bash
Hello Harness v1.0 · 流式多轮对话（输入 exit 退出，Ctrl+C 取消本轮）
Session : fb5642f6-2402-4bd0-8189-085aef2c9000
Sessions: D:\Workspace\hui\project\hello-harness\examples\stage-3\25-cli/.sessions

你 > 帮我修复这个项目里的 bug：src/calc.mjs 的 factorial 函数结果不对，请帮我修复
[run:start ] Run ID : 665f40d6-5248-41ab-9642-c4199305148f
[run:start ] Input  : 帮我修复这个项目里的 bug：src/calc.mjs 的 factorial 函数结果不对，请帮我修复
[model:start] 思考中 …
```

![image.png](https://imgbed.ppai.top/file/1786874642384_image.png)


然后就可以看到我们的.sesson画画文件：

```bash
PS D:\Workspace\hui\project\hello-harness> dir examples\stage-3\25-cli\.sessions


    目录: D:\Workspace\hui\project\hello-harness\examples\stage-3\25-cli\.sessions


Mode                 LastWriteTime         Length Name
----                 -------------         ------ ----
-a----         2026/8/16     18:01           4172 fb5642f6-2402-4bd0-8189-085aef2c9000.json
```

然后一条命令接上它：

```bash
$ hello --dir examples/stage-3/25-cli --resume fb5642f6-2402-4bd0-8189-085aef2c9000

Hello Harness v1.0 · 流式多轮对话（输入 exit 退出，Ctrl+C 取消本轮）
Resumed : fb5642f6-2402-4bd0-8189-085aef2c9000（9 条历史消息）
Sessions: D:\Workspace\hui\project\hello-harness\examples\stage-3\25-cli/.sessions


你 > 很好，继续：现在再帮我加一个 divide 函数，并补充一条测试
[run:start ] Run ID : 9811bd04-37eb-4a2c-8443-9cbbfef99565
[run:start ] Input  : 很好，继续：现在再帮我加一个 divide 函数，并补充一条测试
[model:start] 思考中 …

[model:end ] 调用工具：read, bash · 1891 in / 137 out · 3124ms
Step 1 · model  → 调用工具：read, bash
[tool:start] read({"path":"src/calc.mjs"})
[tool:end  ] → "export function add(a, b) {\r\n  return a + b;\r\n}\r\n\r\nexport function factorial(n) {\r\n  if (n <= 1) return 1;\r\n  return n * factorial(n - 1);\r\n}" · 2ms
Step 2 · tool   → read({"path":"src/calc.mjs"}) = "export function add(a, b) {\r\n  return a + b;\r\n}\r\n\r\nexport function factorial(n) {\r\n  if (n <= 1) return 1;\r\n  return n * factorial(n - 1);\r\n}"
[tool:start] bash({"command":"find . -name \"*.test.*\" -o -name \"*spec*\" 2>/dev/null; ls -la test/ 2>/dev/null || echo \"no test dir\""})
```

![image.png](https://imgbed.ppai.top/file/1786874862908_image.png)

> 重点关注 Step 1，大模型很聪明的知道，是需要再我们之前对话的 `src/calc.mjs` 文件中，添加新的函数，从而实现继续对话

当然，再复测验证的小伙伴，请重点观察「续跑」的以下关键证据：

| 观察点 | 期望 | 实测转录 |
| --- | --- | --- |
| 启动横幅 | 打印 `Resumed : <id>（N 条历史消息）` | `Resumed : fb5642f6-….json（9 条历史消息）` ✓ |
| 上下文接续 | 模型记得昨天改了什么 | 第一刀直接 `edit` 昨天的 `factorial(n - 1)`，没重读项目背景 ✓ |
| 方法论延续 | 失败能续着修 | edit 因 CRLF 匹配失败 → read 重读 → 换 write 重写 → npm test ✓ |
| 落盘继续 | resume 后写回**同一个**文件 | `.sessions/16b6b867-….json` 从 9 条长到 34 条 ✓ |
| 会话身份 | 不换新 id | 全程还是 `fb5642f6-…` ✓ |

**跑法二：续一个不存在的会话，看人话报错**：

```bash
$ hello --dir examples/stage-3/25-cli --resume deadbeef-dead-4bee-dead-beefdeadbeef
调用失败：没有找到会话 deadbeef-dead-4bee-dead-beefdeadbeef，请检查 .sessions/ 目录
```

**跑法三：老姿势全保留**——`--chat`、`hello "问题"`、`pnpm dev -- ...` 一条都不破：

```bash
$ hello --chat                                  # 新建多轮对话（不 resume）
$ hello "帮我修复这个项目"                        # 默认工具模式（单轮）
$ pnpm dev -- --tools "问题"                     # ch24 老姿势
```

> 这一章也不做无模型 demo：**resume 的价值必须真实**——「昨天修到一半的 bug，今天一条命令接着修」，只有真模型、真 `.sessions/` 文件才显形。然后就可以愉快的接着玩了。

## 八、新架构解决了什么？

- **「能存」终于配上了「能取」**：`--resume <id>` 从 `.sessions/` 读回会话——**ch27 闲置的 `load()` 正式上岗**；
- **Agent 可以继续昨天的任务**：完整上下文原样装回——**不用重讲背景，模型从断点接着干**；
- **续跑也留痕**：resume 后的每轮照常 `save()`，同一个 `<id>.json` 继续生长——**一场对话的生命线从头到尾连着**；
- **手势清晰**：`--resume` 一个 flag 完成「载入 + 开聊」，`--chat`/默认模式全部保留——**新能力不破坏老姿势**；
- **报错友好**：查无此会话时给可操作提示——**小伙伴知道去哪找、该检查什么**；
- **Stage 3 闭环**：读写更新验证工具(ch19-ch22) → 提示词约束Coding SOP (ch24) → CLI产品包装 (ch25) → 多轮（ch26）→ 落盘（ch27）→ 续跑（ch28），**「Coding CLI」毕业作品正式达成**。

## 九、它又引入了什么问题？

接下来再泼盆冷水，看看这一版还留了哪些坑：

1. **会话列表还是靠翻目录**：`--resume` 需要手抄 id——**没有 `hello --sessions` 列出「有哪些可续」，小伙伴得自己开目录找**；
2. **没有会话的「摘要/标题」**：`.sessions/` 里只有一串 UUID——**用户不知道哪个文件对应哪次任务**；
3. **没有删除/清理手势**：`.sessions/` 只增不减，**没有 `--sessions rm` 或过期清理**，磁盘会慢慢堆满；
4. **跨目录 resume 的歧义**：同一个 id 在不同 `--dir` 下是**不同的文件**——**如果用户记错目录，会续到「另一个项目」的同名会话或报找不到**；
5. **磁盘内容安全**：`.sessions/` 里的工具输出可能含路径、命令等敏感信息——**没有权限保护、没有加密**；
6. **Schema 无版本**：裸 JSON 一旦消息结构升级，**旧文件解析可能出错——缺版本号/迁移机制**。

## 十、毕业作品总览：Coding Agent 最终长成了什么样？

走到这一章，Stage 3 正式收官。我们把视角从「这一章改了什么」拉高到「**这 10 章最终拼出了什么**」——退后一步，看看我们的毕业作品（**接下来**慢慢展开）。

### 回顾：十个章节，一次换装

Coding Agent 不是一次性设计出来的，是**一层一层换装**长大的。回头数一遍：

| 章节 | 补上的能力 | 这匹马长出了什么 |
| --- | --- | --- |
| 19–22 | `read` / `write` / `edit` / `bash` 工具四件套 | **手**：能读代码、写代码、改代码、跑命令 |
| 23 | `Workspace`（root / resolve / read / write / exists） | **缰绳**：一切动作被锁在显式 workspace 内 |
| 24 | System Prompt 方法论 | **章法**：先观察、再修改、修改后验证、不要猜文件 |
| 25 | CLI | **产品壳**：`hello "帮我修复这个项目"` |
| 26 | Session 多轮 | **记忆**：一场对话可跨步骤持续 |
| 27 | SessionStore 持久化 | **存档**：对话落盘到 `.sessions/` |
| 28 | `--resume` | **复活**：昨天的任务，今天一条命令接着干 |

每走一步，都是在上一版肩膀上长出来的：没有工具就没有 workspace 可约束，没有 workspace 章法会乱动手，没有章法修出来的 bug 没人敢信，没有壳子会话连入口都没有。

### 最终架构：九块积木，各司其职

毕业作品的 `src/` 长这样——**每块积木都只做一件事，谁也不越界**：

```text
src/
  model/        # Model 抽象（provider 无关，ch02）
  context/      # AgentContext（Agent 当前可见的世界，ch11）
  agent/        # AgentRuntime / AgentStep / AgentRun（循环 + 停止条件，ch12-14）
  events/       # 事件系统（每一步都可观察，ch15）
  errors/       # 结构化错误模型（ch16）
  tools/        # Tool 接口 + Registry + 6 件工具（ch10, 19-22）
  workspace/    # Workspace（ch23）
  cli/          # 命令行入口 + 渲染 + chat 会话（ch25-28）
  session/      # Session + SessionStore（ch26-27）
```

对应 AGENTS.md 的架构边界，逐个对账：

- **Model 不知道 Agent** ✓ —— `model/` 只管 provider 无关的输入输出与流式响应；
- **Tool 不知道 Agent** ✓ —— `tools/` 只处理 `input → environment → output`；
- **Runtime 不绑定 Provider** ✓ —— `agent/` 与 `cli/` 通过接口协作，换模型零改动；
- **Core 保持小而可读** ✓ —— 核心抽象只有几个接口：`Model`、`Tool`、`Runtime`、`Session`。

> 这就是「先教学、后抽象」的成果：**每一块积木都是某章为了解决当下问题才引入的，没有一个是「未来可能要用」的预埋件。**

### 怎么用：六个姿势一张表

毕业作品的全部用法，浓缩成一张命令表——**记住 `hello` 一个词，六种姿势全覆盖**（**最基本的**，手动加强语气，这表建议收藏）：

| 姿势 | 命令 | 什么时候用 |
| --- | --- | --- |
| 单轮修 bug | `hello "帮我修复这个项目"` | 日常最常用，一把梭 |
| 指定项目 | `hello --dir <目录> "帮我修复这个项目"` | 项目不在当前目录 |
| 多轮对话 | `hello --chat` | 一个任务要多步追问、反复确认 |
| 续跑昨天 | `hello --resume <会话id>` | 昨天的对话今天接着干 |
| 纯流式聊天 | `hello --stream "问题"` | 只聊天、不碰工具 |
| 一次性生成 | `hello --full "问题"` | 只想要一段文字回答 |

其中 `--chat` 与 `--resume` 都走同一个多轮入口；`--dir` 决定 Workspace 根目录，所有文件动作都被锁在里面。

### 它到底能干什么？诚实盘点

毕业作品能干的、不能干的，一次性说清：

| 能 | 不能 |
| --- | --- |
| 读、写、改代码，跑命令，跑测试，自查结果 | 没有并发——一次只能盯一个任务 |
| 按「先观察、再修改、再验证」的章法干活 | 没有子 Agent——不能把任务拆给别人 |
| 多轮对话，上下文连续 | 没有记忆管理系统——只靠上下文里的消息 |
| 会话落盘，跨进程续跑 | 没有权限门——workspace 内动作默认放行 |
| 可观察：每步、每工具、每错误、每耗时都可见 | 没有能力扩展体系——6 件工具就是全部 |

> 一句话总结毕业作品：
> **`hello`——一个住进你代码库里的命令行 Coding Agent：会读、会写、会改、会跑、会验，多轮对话，落盘续跑。它「小」，但它「完整」——六个姿势、九块积木、一条方法论，就是完整的一个 Stage。**

### 毕业作品的「灵魂一句」

从 Stage 1 HelloAgent 的「一个循环」，到 Stage 2 HelloHarness 的「一套马具」，再到这一 Stage HelloCodingAgent 的「一个产品」——如果只让你记住一句话，无疑就是下面这句了：

> **Agent 负责「干」，Harness 负责「管」，Coding Agent 负责在真实代码库里按章法干活。**

而我们毕业作品证明的，是这句话能成立：**一条命令、一个目录、一场对话，昨天修到一半的 bug，今天接着修。**

## 十一、下一章

`--resume` 让对话能跨进程续跑，但**续跑的入口还靠用户手抄 UUID**——昨天的对话是哪个文件、今天想续哪一场，都没有「列表」。这正是 Stage 3 结尾遗留的口子，也是 Stage 4 的开场话题。

从下一章开始，我们进入 **Stage 4 · Hello Pi**：当工具、会话、能力越来越多时，如何让 **Core 保持小而稳定**，把扩展能力交给 Extension 插件——Pi 最有价值的思想，**Minimal Core + Extension First**。

> **Session 给了对话身份，持久化给了它存续，resume 给了它复活——三章合璧，Coding CLI 毕业。下一站，让 Core 瘦身，让能力外挂。**

写代码、写文档的小伙伴们，Stage 3 到此收官，Stage 4 见。

---

上面这些就是 `--resume` 的基本使用姿势了，有啥用、怎么接着玩 Stage 4 的 Extension，留在下一篇逐一展开。尽信书则不如，以上内容纯属一家之言，因个人能力有限，难免有疏漏和错误之处，如发现 bug 或者有更好的建议，欢迎批评指正，不吝感激 🙃  欢迎点赞、关注公众号「一灰灰Blog」 我们下章见

---

微信公众号: 一灰灰Blog

