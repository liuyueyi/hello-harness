---
title: "56 · 从 Run 提炼 Experience"
description: "复用 Run/Step/ToolResult/Event，从真实执行记录提炼 Memory 候选：哪里失败、如何解决、何时适用。"
gitTag: "v56-experience-extraction"
stage: 6
---

# 56 · 从 Run 提炼 Experience

> <span class="stage-badge">Stage Hello Continual Harness</span> · <span class="tag-badge">v56-experience-extraction</span> · <span class="stage-badge">规划中</span>

## 本章目标

复用 Stage 2 已有的 Run / Step / Tool Result / Event，从真实执行记录中提炼经验：

```text
Run → ExperienceExtractor → Memory Candidate
```

> 真正值得保存的是「什么地方失败了？最后怎么解决？以后什么时候适用？」，而不是把所有聊天记录永久保存。

例如一次 Run：`npm test 失败 → 发现必须先 pnpm build → 修复成功`，最终提炼：

```json
{
  "lesson": "该项目运行测试前需要先执行 pnpm build",
  "useWhen": "运行该仓库测试时"
}
```

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

- AgentRun / AgentStep / ToolResult / Events（ch13–17）

## 演示建议

从一个真实的 Run 步骤序列中抽取一条 Memory Candidate（mock 即可）。

## 遗留矛盾

经验是「记住一件事」；那「固化一套可重复执行的方法」应该放在哪里？→ Skill。

## 验收清单

- [ ] 正文撰写
- [ ] 最小示例与可复现的演示命令
- [ ] 对应 Git Tag `v56-experience-extraction`