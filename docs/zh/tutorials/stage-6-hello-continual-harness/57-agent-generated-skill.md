---
title: "57 · Agent Generated Skill"
description: "把 Stage 4 的 Developer-authored Skill 演进为 Agent-proposed Skill：Repeated Experience → Generalize → Skill Proposal → Skill State。"
gitTag: "v57-generated-skill"
stage: 6
---

# 57 · Agent Generated Skill

> <span class="stage-badge">Stage Hello Continual Harness</span> · <span class="tag-badge">v57-generated-skill</span> · <span class="stage-badge">规划中</span>

## 本章目标

把 Stage 4 的 Developer-authored Skill 演进为 Agent-proposed Skill：

```text
Repeated Experience → Generalize → Skill Proposal → Skill State
```

例如 Agent 发现「查 package → npm pack → 解压 → 统计文件 → 分析体积」重复出现，可提出 `package-analysis` Skill。

> 关键区分：Memory 适合「记住一件事」，Skill 适合「固化一套可重复执行的方法」。

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

- SkillRegistry / SkillLoader / Skill Injection（ch34–36）、Agent Skills（Stage 5）、Experience（ch56）

## 演示建议

Agent 从两段重复工作流中提出一个 Skill Proposal，经 State API 落为 Skill State。

## 遗留矛盾

除了 Memory / Skill，Prompt 与 Agent Profile 也应该进入统一演进体系。

## 验收清单

- [ ] 正文撰写
- [ ] 最小示例与可复现的演示命令
- [ ] 对应 Git Tag `v57-generated-skill`
