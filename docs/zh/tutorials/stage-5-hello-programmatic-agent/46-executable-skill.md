---
title: "46 · Executable Skills"
description: "Skill 从 Prompt 级能力升维为可调用能力：SKILL.md + implementation，模型代码里 await dependency_analysis(...)。"
gitTag: "v46-executable-skill"
stage: 5
---

# 46 · Executable Skills

> <span class="stage-badge">Stage Hello Programmatic Agent</span> · <span class="tag-badge">v46-executable-skill</span> · <span class="stage-badge">规划中</span>

## 本章目标

Stage 4 的 Skill 是「告诉模型怎么做」（Prompt-level）。本章让它自然演进为两类：

```text
Skill
├── Instruction Skill    SKILL.md
└── Executable Skill     SKILL.md + implementation（可调用）
```

例如：

```text
skills/
  dependency-analysis/
    SKILL.md
    skill.py
```

`SkillRegistry` 同时承载 prompt instructions 与 callable bindings，模型代码里：

```python
result = await dependency_analysis("./src")
```

继承路线：**Prompt Skill → Executable Skill → Reusable Capability**，而不是突然出现「Python Runtime 自己的 skills」。

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

- **SkillRegistry / SkillLoader / SkillLoaderInjection**（ch34–36）、编程面（ch43–44）

## 演示建议

把 refactor / debugging 技能之一升级为 Executable Skill，验证 `await 技能(...)` 从同一 SkillRegistry 命中。

## 遗留矛盾

skill 的实现也是「代码」，它和模型代码共享同一执行环境——那么「调用 Agent」也能作为一种能力吗？

## 验收清单

- [ ] 正文撰写
- [ ] 最小示例与可复现的演示命令
- [ ] 对应 Git Tag `v46-executable-skill`