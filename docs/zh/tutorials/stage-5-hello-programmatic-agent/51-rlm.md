---
title: "51 · RLM：把 Harness 当作可编程环境"
description: "阶段总结：正式命名 RLM Programming Model——Recursive Language Model。"
gitTag: "v51-rlm"
stage: 5
---

# 51 · RLM：把 Harness 当作可编程环境

> <span class="stage-badge">Stage Hello Programmatic Agent</span> · <span class="tag-badge">v51-rlm</span> · <span class="stage-badge">规划中</span>

## 本章目标

阶段收尾。把 ch42–50 走过的路收成一句话，并正式给它一个名字——**Recursive Language Model（RLM）**：

```text
RLM Programming Model

Model → Program → Harness Capability / Skill / Context Data / Agent
```

RLM = Programmatic Capability Calling（ch44–46）＋ Programmatic Agent Calling（ch47–49）＋ Persistent Working State（ch50）。它不是新的 Harness，而是**把前 40 篇辛苦构建的整个 Harness，变成一个模型可以编程调用的世界**。

> 完整演进：Tool Calling Agent → Programmatic Tool Calling → Programmatic Skills → Agent as Function → Recursive Agent → Persistent Working State → RLM。

## 正文结构

撰写时按统一模板展开：

1. 上一版存在什么问题？
2. 本篇解决什么问题？
3. 先看最终效果
4. 架构变化
5. 核心抽象
6. 实现代码
7. 运行 Demo
8. 新架构解决了什么？
9. 它又引入了什么问题？
10. 下一章

## 复用

以上全部：ToolRegistry、Permission、Skill、AgentRuntime、Session、Events。

## 演示建议

毕业演示：模型用一段程序同时编排 fs 能力、执行一个 Executable Skill、并行 spawn 两个子 Agent，并把中间结果留在 program state。

## 遗留矛盾

Agent 现在能「使用」Harness 的一切，但 Harness 的 Prompt / Skill / Memory / Agent 配置仍是开发者的领地——Agent 能改进它吗？→ Stage 6 Continual Harness。

## 验收清单

- [ ] 正文撰写
- [ ] 最小示例与可复现的演示命令
- [ ] 对应 Git Tag `v51-rlm`