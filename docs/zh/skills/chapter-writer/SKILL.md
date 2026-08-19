---
name: chapter-writer
title: 教程章节推进 Skill
description: 推进 hello-harness 的一篇教程章节（Stage N）：先识别章节类型，再按「读事实来源 → 调研现状 → 最小落地 → 验证 → 教学化 → 收尾」推进，产出可运行、可验证、可检出的章节完成态。当用户要求「按计划推进/继续章节 NN」「实现某章」「撰写教程正文」时使用。
stage: 3
---

# chapter-writer：教程章节推进

> 本 Skill 沉淀了推进 `hello-harness` 教程章节的通用方法论。它不是「怎么写某一章」，而是回答：**如何把 `plan/教程规划.md` 里的一个章节条目，推进成可运行、可验证、可检出的完成态。**

## 一、这个 Skill 在做什么

本仓库的教程不是「写文章」，而是「让每一章都成为一个可运行、可验证、可检出的完成态」。推进一章，本质是完成五件事：

1. **讲清楚「为什么需要这一层」**——演进叙事，不是功能罗列；
2. **让代码落地且可运行**——最小实现 + 配套 demo；
3. **让读者能复现**——可复制的命令 + 可检出的 Git Tag；
4. **让边界可观察**——护栏、错误语义、已知限制全部显式；
5. **让下一章有理由存在**——本章刻意不做的事，成为下一章的伏笔。

## 二、核心原则（先立规矩）

- **事实来源优先**：`plan/教程规划.md` 的「实现说明」是本章的验收标准；`plan/产品路线.md` 是叙事基线；`AGENTS.md` 是边界红线。**实现与规划冲突时，更新规划或在变更说明中明确原因。**
- **先教学后抽象**：只引入解决本章问题所需的最小概念，不为「未来可能需要」过早设计。
- **核心小且可读**：`core` 的职责与依赖必须克制；新增代码向建议目录结构靠拢，不堆进单文件。
- **每章可运行可验证**：行为变化配套可复现 demo；命令行/教程行为配套可复制的演示。
- **不隐瞒复杂性**：并发、权限、失败、上下文、持久化的边界都要显式、可观察，不用「魔法」掩盖。
- **克制边界**：刻意不做的能力，写入正文「已知限制」并点名归属章节，既立边界又埋伏笔。
- **架构与安全纪律**：Model/Tool/Runtime 解耦；文件/Shell 能力限定显式 workspace；越界一律 `permission`；有副作用的操作留好观察点。

## 三、章节类型识别（先定性，再动手）

不同章节「长」的方式完全不同。开工前先判断本章属于哪一类，这决定了落地重点与代码量：

| 类型 | 典型章节 | 落地重点 |
| --- | --- | --- |
| **能力章**（新增 Tool / Capability） | 19 read、20 write、21 edit、22 bash | 新工厂函数 + 护栏（路径/越界/参数校验/返回值语义）+ CLI 注册一行 + 无模型 demo 场景矩阵 |
| **架构章**（新抽象 / 重构） | 12 runtime、13 step、15 events | 新抽象落地 + 调用点迁移 + 旧 API 退役；保持「换芯不改脸」，对外行为尽量不变 |
| **方法论/概念章**（Prompt、心智模型） | 24 system prompt、48 context variable | 代码极少甚至为零，重正文叙事与心智模型 |
| **阶段总结章**（里程碑） | 18 minimal harness、56 rlm | 目录结构落地、能力汇总、里程碑 Tag |

> 判断错误会导致最典型的翻车：能力章忘了给边界，概念章堆了一堆无必要的代码，架构章把对外 API 改了读者跟不动。

## 四、通用工作流

### Phase 0 · 准备：读事实来源

- `plan/教程规划.md`：定位本章「实现说明」（验收标准），特别注意其中的「克制边界」句；
- `plan/产品路线.md`：本章在演进路线中的位置与叙事基调；
- 骨架 `docs/zh/tutorials/stage-N-*/NN-slug.md`：frontmatter（`title` / `description` / `gitTag` / `stage`）与「验收清单」；
- 上一章正文结尾的「下一章」预告——**它就是本章的开场引子，必须呼应**；
- `AGENTS.md`：架构边界、阶段性安全规则、实现约定。

### Phase 1 · 调研现状

- 读既有抽象与调用点：`packages/core/src/*.ts`（`Tool`/`ToolResult`/`ErrorKind`/`AgentRuntime`/`AgentEvent`）、`packages/cli/src/index.ts` 的注册方式与 `SYSTEM_PROMPT`、`packages/extensions/src/*.ts` 的 Extension API 与资源注册表、`packages/coding/src/*.ts` 的工具/权限/组装层（v40 起代码从 `src/` 迁入 `packages/`，历史章节正文仍以对应 Git Tag 为准）；
- 读上一章实现与 demo，对齐风格、复用点与演进线索；
- 确认测试策略：本仓库无单测框架，**行为验证 = 可复现 demo**（符合 AGENTS.md「行为变化优先提供可复制的 demo」）。

### Phase 2 · 最小落地（按章节类型）

- **能力章**：新增工厂 `createXxx(env)` 绑定环境 → 复用既有护栏（`resolve`+包含判断、`stat` 存在性判断、参数校验、可观察的返回值语义）→ CLI 注册一行 + `SYSTEM_PROMPT` 补一句使用约束；
- **架构章**：新抽象落地 + 调用点迁移 + 旧 API 退役，保持对外行为稳定；
- **概念/方法论章**：少量代码或纯正文；
- **总结章**：目录结构落地与能力汇总。

落地自查：核心只加必要文件；不引入后续章节能力；刻意不做项列入「已知限制」。

### Phase 3 · 验证

```bash
pnpm typecheck
node --import tsx examples/stage-N/NN-slug/demo.mts   # 能力章必跑
pnpm docs:build                                        # 确认新页面渲染
```

验证的意义：**正文「最终效果」必须来自真实运行，先跑通再落笔。**

### Phase 4 · 教学化：撰写正文

- 固定模板 10 节：① 上一版存在什么问题？② 本篇解决什么问题？③ 先看最终效果 ④ 架构变化 ⑤ 核心抽象 ⑥ 实现代码 ⑦ 运行 Demo ⑧ 新架构解决了什么？⑨ 它又引入了什么问题？⑩ 下一章；
- frontmatter 齐备；头部徽章行 `<span class="stage-badge">…</span> · <span class="tag-badge">vNN-xxx</span>`；文末按仓库惯例署名；
- **演进叙事四问**贯穿全文：为什么要增加这一层 / 旧架构出现了什么问题 / 新抽象解决了什么 / 又带来了什么新问题；
- ③ 贴真实输出，⑨ 为下一章埋伏笔（与下一章预告互文）；
- 代码块与 `src/` 真实文件一致——写完回读一遍源码比对。

### Phase 5 · 收尾

- 更新 `docs/zh/tutorials/stage-N-*/index.md`：该章状态「规划中」→「已完成」；
- 清理临时文件、误写入仓库的产物；`git status` 核对变更集合是否只含预期文件；
- **不主动 commit / 打 tag**，除非用户明确要求；若提交：commit message 沿用 `feat: chapter NN xxx - …`，tag 用 `vNN-xxx`（见 `plan/教程规划.md` 的 Tag 表）。

## 五、跨章节通用坑位

1. **规划优先**：骨架的「验收清单」与规划的「实现说明」是合同，别凭印象写；
2. **真实输出**：正文「最终效果」必须来自真实运行，数字、路径、字符数都要与实测对得上，不许手编；
3. **无模型 demo 优先**：能力章先给「不需要 API Key 的直驱 demo」，再给「真实对话」转录；
4. **换芯不改脸**：架构章尽量保持循环与调用点语义不变，读者才跟得上；
5. **workspace 边界**：文件工具 root 必须在工厂内 `resolve` 定死；越界一律 `permission`，与普通失败（`tool`）分级；
6. **环境坑（捕获真实 Chat 转录时）**：
   - workspace root = 启动 CLI 的 `cwd`；`--import tsx`、`.env` 均按 cwd 相对解析 → 从临时 workspace 启动，并传仓库的绝对路径；
   - Windows PowerShell 管道中文需显式 UTF8 编码；prompt 避免反引号（here-string 里是转义符）；
   - 跑完查 `git status`，防止真实模型把写入落到仓库——用临时目录并事后清理；
7. **一致性**：正文代码块、demo、`src/` 三者必须一致。

## 六、完成定义（DoD）

- [ ] 规划「实现说明」全部落地；未提前引入后续章节能力；
- [ ] 章节类型判断正确，落地重点匹配；
- [ ] 正文 10 节 + frontmatter + 演进叙事；真实输出与实测一致；
- [ ] demo 可运行（能力章无需模型）且输出与正文一致；
- [ ] stage index.md 状态已改为「已完成」；
- [ ] `pnpm typecheck` 与 `pnpm docs:build` 通过；
- [ ] 无遗留临时文件、无误写入仓库的文件。

## 七、相关文件

- 规划与约定：`plan/教程规划.md`、`plan/产品路线.md`、`AGENTS.md`、`docs/zh/resources/index.md`
- 骨架与导航：`docs/zh/tutorials/stage-N-*/NN-slug.md`、`docs/zh/tutorials/stage-N-*/index.md`
- 既有抽象与调用点：`packages/core/src/*.ts`（六件套 + errors + permission gate）、`packages/extensions/src/*.ts`（Extension API + Registry + PackageLoader + Prompt/Skill 注册表）、`packages/coding/src/*.ts`（Workspace + 工具 + 权限策略 + hello-coding）、`packages/cli/src/index.ts`
- 参考样本（非唯一来源）：
  - 能力章 + 真实转录：ch19 `read`、ch20 `write`
  - 架构章：ch12 `runtime`（换芯不改脸）
  - 总结章 + 目录落地：ch18 `minimal harness`
