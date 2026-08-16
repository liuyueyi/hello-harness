---
title: "28 · Resume"
description: "hello --resume <会话id>：从 .sessions/ 读回昨天的一场对话，让 Agent 继续干活。第一次实现「Agent 可以继续昨天的任务」。"
gitTag: "v28-resume"
stage: 3
---

# 28 · Resume

> <span class="stage-badge">Stage Hello Coding Agent</span> · <span class="tag-badge">v28-resume</span>

第二十七章，我们把 Session 写进了磁盘——`.sessions/<id>.json` 里躺着完整的一场对话：system 方法论、每条 user 指令、每次工具调用、每个结果、每轮回答，一字不差。退出 CLI，对话依然存在。

但兄弟们，**文件「躺」着不等于对话「活」着**。我们有 `SessionStore.load(id)` 能从磁盘读回，可**没有任何命令真的去调用它**——没有 `--resume`，`.sessions/` 只是一堆没人读的 JSON。这一章，我们把「存」变成「取回来用」：`hello --resume <会话id>`，让 Agent **继续昨天的任务**。

<!-- more -->

## 一、上一版存在什么问题？

回看 ch27：

1. **能存不能取**：`SessionStore.save()` 每轮自动落盘，但 `load()` 实现完就闲置了——**数据在磁盘上，却没有任何入口把它读回来**；
2. **会话无法续跑**：`hello --chat` 永远是**开一场新对话**——昨天的 15 条消息、修过的 bug、得出的结论，**重新开聊就全部作废**；
3. **用户没法指向一场对话**：即使知道有 `.sessions/`，也没有命令说「**就是这一场，继续**」——续跑的能力存在，续跑的手势不存在；
4. **上下文恢复是 API 而不是产品**：`store.load()` + `new Session(id, messages)` 是库的用法，**用户要的是 `--resume` 一个单词**；
5. **Stage 3 的承诺还差最后一步**：ch26–28 的叙事是「多轮 → 落盘 → 续跑」，**前两步都做了，最后一步「Agent 可以继续昨天的任务」还没兑现**。

> 一句话：**上一版是「建了库却没人查」——`.sessions/` 里躺着完整的对话，但用户没有任何办法说「继续这一场」。持久化到位了，续跑的手势缺席了。**

## 二、本篇解决什么问题？

1. **新增 `hello --resume <会话id>`**：从 `.sessions/` 读回指定会话，**接着它继续多轮对话**——「继续昨天的任务」成了一句人话命令；
2. **恢复的是整个上下文**：`resume` 不是「记住结论」，而是**把 15 条历史消息原样装回 `AgentContext`**——模型从昨天断掉的地方接着想；
3. **续跑的结果继续落盘**：resume 后的每一轮照常 `store.save()`——**同一个 `<id>.json` 继续生长，从 15 条消息长到 33 条**；
4. **给出清晰的反馈**：启动时打印 `Resumed : <id>（N 条历史消息）`——**用户一眼看到「我确实续上了昨天那场」**；
5. **查无此会话说人话**：`--resume` 一个不存在的 id，报错「**没有找到会话 xxx，请检查 .sessions/ 目录**」——**不是堆栈，是人话**。

核心心智模型：

> **save 是「让对话活过进程」的前提，resume 是「让对话回来干活」的手势。SessionStore 是仓库，--resume 是取货单——「存得下」+「取得出」= 「一场对话真正可跨会话续跑」。**

解决完上面五件事，把线串一下：**上一版「能存不能取、没有续跑入口、resume 缺席」这些遗留问题 → 这一章用「--resume 从磁盘读回会话继续聊」解决 → 接下来看昨天修了一半的 bug，今天一条命令接上。**

### 解决之后，我们收获了什么？

- **一句命令继续昨天**：`hello --resume <id>`——**不用重新解释项目背景，Agent 记得昨天改了什么**；
- **上下文无缝接续**：resume 把完整历史装回上下文——**模型直接「接着昨天的思路」干活，而不是从头猜**；
- **续跑也留痕**：resume 后的对话继续写回**同一个** `.sessions/<id>.json`——**一场对话的完整生命线，从第一天到最后一天都连着**；
- **反馈清晰**：`Resumed : <id>（N 条历史消息）`——**续没续上，一眼便知**；
- **报错友好**：查无此会话时给出可操作的提示——**用户知道去哪找、该检查什么**。

> 一句话收个尾：遗留的「能存不能取、没有续跑手势」问题被这一章的 `--resume` 解决掉，换来的则是「昨天修到一半的 bug，今天一条命令接着修」——Stage 3 的「Coding CLI」承诺，就此闭环。

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

真实转录——注意启动行变成了 `Resumed`：

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

> 注意第二步的第一刀：模型**没有**先 `bash` 列目录、**没有**问用户「这个项目是什么」、**没有**重新读一遍项目背景——它**直接对昨天改过的 `factorial(n - 1)` 下手 edit**。这就是「继续昨天的任务」的实感：**不是从零开始，是从断点继续。**

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

**关键点**：resume 和新建对话**共享同一个 `chat()` 循环**——差别只在开头：**没有 resumeId 就开新会话，有 resumeId 就从磁盘载入旧会话**。载入之后，turn / save / summary 全部复用，零额外逻辑。

目录变化只有两处小改：

```text
src/
  cli/
    chat.ts     # + createOrResumeSession()：新建 vs 载入的分支
    index.ts    # + --resume 参数解析、用法说明、dispatch
```

## 五、核心抽象

这一章**没有新增核心抽象**——核心是 ch26 的 `Session` 和 ch27 的 `SessionStore`。本章新增的是一个**组合动作**：

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

三个要点：

1. **载入 = 构造函数的另一条路**：`new Session(id, messages)` 既能用于「从零开始」也能用于「从磁盘恢复」——**同一个类，两种出生方式**；
2. **id 保持不变**：恢复时用 `record.id` 而不是重新随机——**续跑的仍是「那一场」对话，同一个文件继续写**；
3. **resume 是 chat 的一个开关**：不加新模式、不加新循环——**`args.resume` 存在就走载入分支，否则照旧**——**最小改动接入已有产品**。

> **为什么要这样设计？** 因为「续跑」不是新能力，而是「Session 的另一种构造方式」——**上下文类、存储类都没有变，变的是 CLI 的入口参数**。最小、可读、不重复。

## 六、实现代码

### `src/cli/chat.ts`：新建 vs 载入

`chat()` 新增可选参数 `resumeId`，开头分流：

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

**重点**：`store.load(id)` 返回 `null`（查无此会话）时**直接抛错**——`main().catch` 会把它打印成人话并 `exit 1`。**「查无此会话」是业务状态，用清晰的错误表达，而不是让用户看到空对话发懵。**

### `src/cli/index.ts`：参数解析与 dispatch

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

**重点**：`args.chat || args.resume`——**`--resume` 隐含「多轮对话模式」**，用户不用既 `--resume` 又 `--chat`。一个 flag 完成「载入 + 开聊」两件事。

## 七、运行 Demo

**跑法一：续跑昨天修了一半的任务（本章的演示，复现第三节转录）**。先确认 `.sessions/` 里有会话：

```bash
$ dir examples\stage-3\25-cli\.sessions
16b6b867-57ec-4717-a03b-ed4a94461a33.json
```

然后一条命令接上它：

```bash
$ hello --dir examples/stage-3/25-cli --resume 16b6b867-57ec-4717-a03b-ed4a94461a33
Hello Harness v1.0 · 流式多轮对话（输入 exit 退出，Ctrl+C 取消本轮）
Resumed : 16b6b867-57ec-4717-a03b-ed4a94461a33（15 条历史消息）

你 > 很好，继续：现在再帮我加一个 divide 函数，并补充一条测试
…（模型记得昨天改过 factorial，直接 edit → write → npm test，pass 6 / fail 0）

你 > exit
```

观察「续跑」的关键证据：

| 观察点 | 期望 | 实测转录 |
| --- | --- | --- |
| 启动横幅 | 打印 `Resumed : <id>（N 条历史消息）` | `Resumed : 16b6b867-….json（15 条历史消息）` ✓ |
| 上下文接续 | 模型记得昨天改了什么 | 第一刀直接 `edit` 昨天的 `factorial(n - 1)`，没重读项目背景 ✓ |
| 方法论延续 | 失败能续着修 | edit 因 CRLF 匹配失败 → read 重读 → 换 write 重写 → npm test ✓ |
| 落盘继续 | resume 后写回**同一个**文件 | `.sessions/16b6b867-….json` 从 15 条长到 33 条 ✓ |
| 会话身份 | 不换新 id | 全程还是 `16b6b867-…` ✓ |

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

> 这一章也不做无模型 demo：**resume 的价值必须真实**——「昨天修到一半的 bug，今天一条命令接着修」，只有真模型、真 `.sessions/` 文件才显形。

## 八、新架构解决了什么？

- **「能存」终于配上了「能取」**：`--resume <id>` 从 `.sessions/` 读回会话——**ch27 闲置的 `load()` 正式上岗**；
- **Agent 可以继续昨天的任务**：完整上下文原样装回——**不用重讲背景，模型从断点接着干**；
- **续跑也留痕**：resume 后的每轮照常 `save()`，同一个 `<id>.json` 继续生长——**一场对话的生命线从头到尾连着**；
- **手势清晰**：`--resume` 一个 flag 完成「载入 + 开聊」，`--chat`/默认模式全部保留——**新能力不破坏老姿势**；
- **报错友好**：查无此会话时给可操作提示——**用户知道去哪找、该检查什么**；
- **Stage 3 闭环**：多轮（ch26）→ 落盘（ch27）→ 续跑（ch28），**「Coding CLI」毕业作品正式达成**。

## 九、它又引入了什么问题？

1. **会话列表还是靠翻目录**：`--resume` 需要手抄 id——**没有 `hello --sessions` 列出「有哪些可续」，用户得自己开目录找**；
2. **没有会话的「摘要/标题」**：`.sessions/` 里只有一串 UUID——**用户不知道哪个文件对应哪次任务**；
3. **没有删除/清理手势**：`.sessions/` 只增不减，**没有 `--sessions rm` 或过期清理**，磁盘会慢慢堆满；
4. **跨目录 resume 的歧义**：同一个 id 在不同 `--dir` 下是**不同的文件**——**如果用户记错目录，会续到「另一个项目」的同名会话或报找不到**；
5. **磁盘内容安全**：`.sessions/` 里的工具输出可能含路径、命令等敏感信息——**没有权限保护、没有加密**；
6. **Schema 无版本**：裸 JSON 一旦消息结构升级，**旧文件解析可能出错——缺版本号/迁移机制**。

## 十、下一章

`--resume` 让对话能跨进程续跑，但**续跑的入口还靠用户手抄 UUID**——昨天的对话是哪个文件、今天想续哪一场，都没有「列表」。这正是 Stage 3 结尾遗留的口子，也是 Stage 4 的开场话题。

从下一章开始，我们进入 **Stage 4 · Hello Pi**：当工具、会话、能力越来越多时，如何让 **Core 保持小而稳定**，把扩展能力交给 Extension 插件——Pi 最有价值的思想，**Minimal Core + Extension First**。

> **Session 给了对话身份，持久化给了它存续，resume 给了它复活——三章合璧，Coding CLI 毕业。下一站，让 Core 瘦身，让能力外挂。**

写代码、写文档的兄弟们，Stage 3 到此收官，Stage 4 见。