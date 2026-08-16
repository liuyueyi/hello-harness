---
title: "27 · Session 持久化"
description: "把 Session 存进磁盘：.sessions/session-id.json。每一轮对话结束自动落盘，让「这场对话」从内存里活到硬盘上。"
gitTag: "v27-session-store"
stage: 3
---

# 27 · Session 持久化

> <span class="stage-badge">Stage Hello Coding Agent</span> · <span class="tag-badge">v27-session-store</span>

第二十六章，我们把多轮对话正式化为 Session——`Session { id, context }`，一场对话有了身份、有了被持有的上下文。转录里两轮对话共享同一个 Session：第一轮修好 `factorial` 的 bug，第二轮接着加 `divide` 函数，模型全程记得上一轮改了什么。

但兄弟们，**Session 只活在内存里**。你按下 `exit`，进程一退出，那个 `id` 和它怀抱的 `context` 就一起烟消云散。下一章我们要 `--resume` 续跑昨天的任务，可昨天的对话**压根没留下足迹**。这一章，我们把 Session 写进磁盘——`.sessions/session-id.json`。

<!-- more -->

## 一、上一版存在什么问题？

回看 ch26 的 Session：

1. **Session 是易失的**：`Session` 对象只存在于进程内存里，**进程退出 = 对话消失**——`id`、`context`、每一轮修过的东西全部归零；
2. **没有地方可「找回来」**：想继续昨天的对话，**没有任何文件、任何索引指向它**——你不知道自己有哪些历史会话，更别说怎么恢复；
3. **「能导出」但没有「导出到哪」**：ch26 给 Session 配了 `snapshot()` / `restore()`，但**只有内存中的对象对拷，没有落盘手段**——数据在，路没有；
4. **上下文随进程生命周期绑定**：`chat()` 里创建的 `Session` 和 CLI 进程同生共死——**进程在则对话在，进程亡则对话亡**；
5. **不可审计、不可复盘**：一场对话从头到尾发生了什么，**没有可查的记录**——修了什么文件、跑过什么命令、得出什么结论，退出后无从回溯。

> 一句话：**上一版的 Session 是「过目即忘」的——它有身份、有内容，但没留下任何足迹。它不是一场「对话」，只是一场「短暂的会话」。**

## 二、本篇解决什么问题？

1. **把 Session 落盘**：新增 `SessionStore`——`save()` 把 `{ id, context }` 写成 `.sessions/<session-id>.json`，**一场对话 = 一个文件**；
2. **每轮对话结束自动保存**：`chat()` 每跑完一轮就 `store.save(session.snapshot())`——**不用用户手动操作，对话实时留痕**；
3. **能按 id 取回**：`load(id)` 从磁盘读回完整会话——**为 ch28 `--resume` 铺好最后一块砖**；
4. **能列出来**：`list()` 返回全部历史会话（按保存时间倒序）——**用户可以知道自己有哪些对话可续**；
5. **落盘位置有边界**：`.sessions/` 放在 **workspace 根目录内**（ch23 的 Workspace 边界）——**持久化的数据也遵守「活动范围锁定在显式 workspace」的安全约定**。

核心心智模型：

> **Session 是「对话的运行时形态」，SessionStore 是「对话的持久化形态」。运行时里对话是一个可聊天的对象，磁盘上对话是一份可恢复的 JSON——「能导出」+「有地方存」=「能续跑」的前提。**

解决完上面五件事，把线串一下：**上一版「Session 只活在内存、没有索引、没有落盘路」这些遗留问题 → 这一章用「SessionStore + .sessions/」解决 → 接下来看一场对话怎么在磁盘上留下完整的脚印。**

### 解决之后，我们收获了什么？

- **对话可以活过进程**：`.sessions/72d72bd0-xxx.json` 躺在硬盘上——**退出 CLI，对话依然存在**；
- **每轮自动留痕**：一轮结束自动 `save()`——**不用手动存，也不会漏存**；
- **能找回来**：`load(id)` 从磁盘恢复完整上下文——**「继续昨天的任务」在技术上可行了**；
- **能看清有什么**：`list()` 按时间倒序列出全部会话——**用户对「我有哪些历史对话」心里有数**；
- **持久化也有边界**：`.sessions/` 落在 workspace 根内，`id` 有格式校验——**既不越界，也不怕路径注入**。

> 一句话收个尾：遗留的「Session 易失、无索引、无落盘路」问题被这一章的 SessionStore 解决掉，换来的则是「一场对话 = 一个 `.sessions/` 下的 JSON 文件」——下一章就把文件读回来续跑。

## 三、先看最终效果

还是 `examples/stage-3/25-cli/`，跑一场和 ch26 一模一样的**两轮对话**。唯一的区别：这一版启动时多打印一行 `Sessions:` 告诉你会存到哪里：

```text
Hello Harness v1.0 · 流式多轮对话（输入 exit 退出，Ctrl+C 取消本轮）
Session : 72d72bd0-c051-47ee-a030-fd4032585c85
Sessions: D:\Workspace\hui\project\hello-harness\examples\stage-3\25-cli\.sessions
```

第一轮（修复 `factorial` bug，read → edit → `npm test` pass 3）：

```text
你 > 帮我修复这个项目里的 bug：src/calc.mjs 的 factorial 函数结果不对，请先观察、再修改、最后运行 npm test 验证
Step 1 · model  → 调用工具：read, bash
Step 4 · model  → 调用工具：edit
Step 5 · tool   → edit({"path":"src/calc.mjs","oldString":"return n * factorial(n - 2);","newString":"return n * factorial(n - 1);"}) = "已替换 1 处"
Step 11 · model → 调用工具：bash
Step 12 · tool  → bash({"command":"npm test"}) → pass 3 / fail 0
Status  : completed (finished)
```

第二轮（同一个 Session，加 `divide` 函数 + 测试，pass 6）：

```text
你 > 很好，现在再帮我加一个 divide 函数，并补充一条测试
Step 2 · tool  → read({"path":"src/calc.mjs"}) = "... return n * factorial(n - 1); ..."  // 记得第一轮
Step 16 · tool → write({"path":"src/calc.mjs","content":"... export function divide(a, b) { ... }"}) = "已写入"
Step 24 · tool → write({"path":"test/calc.test.mjs", ...}) = "已写入"
Step 26 · tool → bash({"command":"npm test"}) → pass 6 / fail 0
Status  : completed (finished)
```

退出之后——**奇迹发生的地方**——磁盘上多了一个文件：

```text
examples/stage-3/25-cli/
  .sessions/
    72d72bd0-c051-47ee-a030-fd4032585c85.json   ← 这一场对话的完整脚印（21KB）
```

打开它，**44 条消息全部在**：

```json
{
  "id": "72d72bd0-c051-47ee-a030-fd4032585c85",
  "context": {
    "messages": [
      { "role": "system", "content": "你是一个简洁、直接的中文 Coding Agent。…" },
      { "role": "user",   "content": "帮我修复这个项目里的 bug：src/calc.mjs 的 factorial 函数结果不对…" },
      { "role": "assistant", "content": "", "toolCalls": [ { "name": "read", "arguments": { "path": "src/calc.mjs" } } ] },
      { "role": "tool",   "toolCallId": "01a0…", "content": "{\"ok\":true,\"value\":\"export function add(a, b) {…\"}" },
      { "role": "assistant", "content": "", "toolCalls": [ { "name": "edit", "arguments": { … } } ] },
      { "role": "tool",   "toolCallId": "01a0…", "content": "{\"ok\":true,\"value\":\"已替换 1 处…\"}" },
      …
      { "role": "assistant", "content": "全部 6 个测试通过 ✅。…", "toolCalls": [] }
    ]
  },
  "savedAt": 1786860624114
}
```

**这就是下一章 `--resume` 的原料**：这个 JSON 文件里，system 方法论、每一条 user 指令、每一次工具调用、每一条工具结果、每一轮的回答，**按顺序一字不差地躺着**。把它读回来塞进 `Session.restore()`，昨天的对话就活了。

## 四、架构变化

这一章在 `session/` 下加了一个「存储」角色，和 Session 平级：

```text
src/session/
  session.ts   # 对话的运行时形态：id + context + turn() + snapshot()/restore()
  store.ts     # 对话的持久化形态：save() / load() / list()  ← 新增
```

在 CLI 里的接线：

```text
chat()
  ├── Session          ← 对话本体（内存）
  └── SessionStore     ← 对话的磁盘落点（.sessions/）
        └── workspace.resolve(".sessions/…")   ← 复用 ch23 的 Workspace 边界
```

**关键设计**：**Session 负责「对话是什么」，SessionStore 负责「对话存哪里」。** Session 不碰文件系统，Store 不碰对话逻辑——**分工明确，各自可测**。而且落盘一律经 `Workspace.resolve()`，**持久化的路径也受 workspace 边界保护**。

## 五、核心抽象

这一章新增一个核心概念——**SessionStore（会话存储）**：

```ts
interface SessionStore {
  save(snapshot: SessionSnapshot): Promise<void>;          // 存：一场对话 → 一个 .json
  load(id: string): Promise<SessionRecord | null>;         // 取：id → 完整会话（找不到返回 null）
  list(): Promise<SessionMeta[]>;                          // 列：全部历史会话（按时间倒序）
}
```

三个设计要点：

1. **一对话一文件**：文件名就是 `id`——**`.sessions/<id>.json` 和一场对话一一对应**，`load(id)` 就是按文件名取文件；
2. **id 有格式校验**：落盘前先正则校验 `id`（只允许十六进制 + 连字符）——**从根上防掉路径注入**（`../` 之类进不了文件名）；
3. **记录带时间戳**：每条记录额外保存 `savedAt`——**`list()` 按它倒序，用户永远先看到最近的对话**。

> **为什么用 JSON？** 因为 `context.messages` 全是「可 JSON 化的普通对象」（role / content / toolCalls / toolCallId）——**snapshot() 产出的东西天然就是 JSON**，`JSON.stringify` 进文件、`JSON.parse` 回来，零转换成本。**最简单的格式配最简单的数据，这就是「最小实现」。**

## 六、实现代码

### `src/session/store.ts`：会话存储

```ts
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { Workspace } from "../workspace/workspace";
import type { SessionSnapshot } from "./session";

export interface SessionMeta {
  id: string;
  savedAt: number;
}

export interface SessionRecord extends SessionSnapshot {
  savedAt: number;
}

export class SessionStore {
  constructor(
    private readonly workspace: Workspace,
    private readonly dirName: string = ".sessions",
  ) {}

  private sessionPath(id: string): string {
    if (!/^[0-9a-fA-F-]{1,64}$/.test(id)) {
      throw new Error(`非法 session id：${id}`);
    }
    return path.join(this.dirName, `${id}.json`);
  }

  async save(snapshot: SessionSnapshot): Promise<void> {
    const record: SessionRecord = { ...snapshot, savedAt: Date.now() };
    await this.workspace.write(this.sessionPath(snapshot.id), JSON.stringify(record, null, 2));
  }

  async load(id: string): Promise<SessionRecord | null> {
    const filePath = this.sessionPath(id);
    if (!(await this.workspace.exists(filePath))) return null;
    const raw = await this.workspace.read(filePath);
    return JSON.parse(raw) as SessionRecord;
  }

  async list(): Promise<SessionMeta[]> {
    const dir = this.workspace.resolve(this.dirName, "访问会话目录");
    const entries = await readdir(dir).catch(() => [] as string[]);
    const metas: SessionMeta[] = [];
    for (const name of entries) {
      if (!name.endsWith(".json")) continue;
      const raw = await readFile(path.join(dir, name), "utf-8").catch(() => null);
      if (!raw) continue;
      const parsed = JSON.parse(raw) as SessionRecord;
      metas.push({ id: parsed.id, savedAt: parsed.savedAt });
    }
    return metas.sort((a, b) => b.savedAt - a.savedAt);
  }
}
```

**重点**：
- **`save()` 只用 `workspace.write()`**——`Workspace` 负责建目录（`mkdir recursive`）、写文件、并校验路径不越界——**持久化也走 ch23 的边界**；
- **`load()` 先 `exists()` 再读**——找不到返回 `null` 而不是抛错——**「查无此会话」是一种正常的业务状态**，ch28 的 resume 拿到 `null` 直接报「没有这个会话」；
- **`list()` 用 `readdir` + 逐个解析**，坏文件跳过（`.catch(() => null)`）——**目录里混入非会话文件也不崩**。

### `src/cli/chat.ts`：每轮结束自动落盘

改动集中在三处：

```ts
const store = new SessionStore(workspace);                       // ① 建 store，绑定 workspace
console.log(`Sessions: ${workspace.root}/.sessions`);            // ② 告诉用户存哪里

for (;;) {
  const prompt = await ask();
  if (prompt === null || prompt.trim() === "" || prompt === "exit" || prompt === "quit") break;

  state.stepCount = 0;
  state.retryCount = 0;
  const run = await session.turn(runtime, prompt);
  await store.save(session.snapshot());                          // ③ 一轮结束，立刻落盘
  printSummary(run, state);
}
```

**重点**：`store.save(session.snapshot())` 放在**每轮 `turn()` 之后**——**聊一句、存一次**。中途 Ctrl+C、断电、崩溃，最多丢当前这一轮，之前的对话全在磁盘上。

### `src/cli/index.ts`：把 workspace 交给 chat

```ts
if (args.chat) {
  await chat(model, registry, SYSTEM_PROMPT, workspace, options);  // 新增 workspace 参数
}
```

**重点**：`chat()` 新增 `workspace` 参数——**store 知道该往哪个 `.sessions/` 写**（`--dir` 指定的项目就有它自己的 `.sessions/`，互不串味）。

### `.gitignore`：会话是本地数据，不是代码

```gitignore
.sessions/
```

**重点**：`.sessions/` 是**用户运行产生的本地数据**，不是仓库的一部分——**加进 .gitignore，让 git 永远不追它们**（和 `.env` 同类待遇）。

## 七、运行 Demo

**跑法一：开一场对话并验证落盘（本章的演示，复现第三节转录）**：

```bash
$ hello --dir examples/stage-3/25-cli --chat
Hello Harness v1.0 · 流式多轮对话（输入 exit 退出，Ctrl+C 取消本轮）
Session : 72d72bd0-c051-47ee-a030-fd4032585c85
Sessions: D:\Workspace\hui\project\hello-harness\examples\stage-3\25-cli\.sessions

你 > 帮我修复这个项目里的 bug：src/calc.mjs 的 factorial 函数结果不对，请先观察、再修改、最后运行 npm test 验证
…（第一轮：read → edit → npm test，pass 3 / fail 0）

你 > 很好，现在再帮我加一个 divide 函数，并补充一条测试
…（第二轮：write → write → npm test，pass 6 / fail 0）

你 > exit
```

退出后验证磁盘留痕：

```bash
$ dir examples\stage-3\25-cli\.sessions
72d72bd0-c051-47ee-a030-fd4032585c85.json   21615 bytes

$ node -e "const fs=require('fs');const d=JSON.parse(fs.readFileSync('examples/stage-3/25-cli/.sessions/'+fs.readdirSync('examples/stage-3/25-cli/.sessions')[0]));console.log('id:',d.id);console.log('messages:',d.context.messages.length);console.log('savedAt:',d.savedAt);"
id: 72d72bd0-c051-47ee-a030-fd4032585c85
messages: 44
savedAt: 1786860624114
```

观察要点：

| 观察点 | 期望 | 实测 |
| --- | --- | --- |
| 落盘位置 | `.sessions/<id>.json`，在 workspace 根内 | `examples/stage-3/25-cli/.sessions/72d72bd0….json` |
| 文件名 | 就是 Session id | `72d72bd0-c051-47ee-a030-fd4032585c85.json` ✓ |
| 内容 | 完整 44 条消息（system/user/assistant/tool） | 消息按顺序一字不差 ✓ |
| 保存时机 | 每轮结束自动存 | 退出后文件已存在 ✓ |
| 边界 | 不越出 workspace | `dirName` 经 `workspace.resolve()` 校验 ✓ |

> 这一章同样不做无模型 demo：**SessionStore 的价值必须由真实对话来填充**——让模型真修一轮 bug，你才能在磁盘上看到「一场对话的完整脚印」，而不是一个空壳 JSON。

## 八、新架构解决了什么？

- **对话可以活过进程**：`.sessions/<id>.json` 让「这场对话」从内存活到硬盘——**退出 CLI，对话还在**；
- **每轮自动留痕**：`turn()` 后立即 `save()`——**聊一句存一次，不用手动、不怕漏存**；
- **可恢复**：`load(id)` 能从磁盘原样取回完整上下文——**ch28 `--resume` 的原料已经备好**；
- **可枚举**：`list()` 倒序列出全部历史会话——**「我有哪些对话可续」一目了然**；
- **持久化也有边界和安全**：`.sessions/` 经 `Workspace.resolve()` 落盘、`id` 有正则校验——**不越界、防注入**；
- **可审计可复盘**：一场对话的工具调用、文件改动、命令结果全部留档——**事后能查「它到底干了什么」**。

## 九、它又引入了什么问题？

1. **只有「存」，还没有「取回来用」**：`load(id)` 实现了，但**没有任何命令或入口真的调用它**——`--resume` 是下一章的事；
2. **没有会话列表入口**：`list()` 实现了，但**用户没有一条命令看到历史会话**——「有什么可续」还只能靠翻目录；
3. **没有并发保护**：多个 `hello` 进程同时写同一个 `.sessions/` 会互相覆盖——**单机单进程够用，但写入不是原子的**；
4. **没有清理/过期策略**：`.sessions/` 只增不减，对话越攒越多——**没有「删掉没用的」或「太旧自动清」**；
5. **持久化格式是裸 JSON**：如果以后消息结构升级（加字段、改类型），**旧文件解析会出兼容性问题——缺一个 schema/版本号**；
6. **磁盘敏感信息**：`.sessions/` 里躺着工具输出，**可能包含路径、命令输出等敏感内容**——文件权限和清理都要留意。

## 十、下一章

`.sessions/` 里躺着一场完整的对话，但**它现在只是「躺」着**——没有任何命令能把这份文件读回来，让 Agent 接着干。下一章我们做 **Resume**：`hello --resume <session-id>` 从磁盘读回会话，让 Agent **继续昨天的任务**。

> **持久化给了对话「墓志铭」，Resume 给它「复活术」——一场昨天的对话，明天还能接着干。**

写代码、写文档的兄弟们，我们下一章见。