---
title: "65 · Eval Task"
description: "定义一个可重复执行、可比较结果的任务单元：EvalTask = id + input + fixture。"
gitTag: "v65-eval-task"
stage: 7
---

# 65 · Eval Task

> <span class="stage-badge">Stage Hello Agent Lab</span> · <span class="tag-badge">v65-eval-task</span> · <span class="stage-badge">规划中</span>

## 本章目标

定义一个可以重复执行的任务单元：

```ts
interface EvalTask {
  id: string;
  input: string;
  fixture: WorkspaceFixture;
}
```

Coding Agent 任务可以是：修复 failing test、实现 TODO、重构函数、修复类型错误、增加 API。

> 如果每次测试 Harness 都是随便问一个新问题，结果不可比较。必须建立：固定输入、固定环境、固定验证方式。

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

- Workspace / fixture（ch23）、Session / Run 输入（ch14）

## 演示建议

定义两个可重复的 EvalTask，复用同一 fixture 目录。

## 遗留矛盾

有任务单元，但怎么客观判定「做完了」？→ Verifier。

## 验收清单

- [ ] 正文撰写
- [ ] 最小示例与可复现的演示命令
- [ ] 对应 Git Tag `v65-eval-task`