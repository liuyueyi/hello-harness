---
title: "62 · Rollback"
description: "建立技术上的回滚能力：inspect history → restore version → compare versions；本阶段只解决如何回滚，何时回滚留给 Stage 7。"
gitTag: "v62-rollback"
stage: 6
---

# 62 · Rollback

> <span class="stage-badge">Stage Hello Continual Harness</span> · <span class="tag-badge">v62-rollback</span> · <span class="stage-badge">规划中</span>

## 本章目标

建立技术上的回滚能力：

```text
v13 → v14 → 发现异常 → rollback → v13
```

> Continual Harness 一旦允许持续修改，就必须接受「有些变化是错误的」。没有 rollback，Continual 很容易变成「不可逆漂移」。

实现：

```text
inspect history
restore version
compare versions
```

> 注意：这一章只解决「如何回滚」，不判断「什么时候应该回滚」——这个判断属于 Stage 7。

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

- HarnessStateStore（ch53）、版本链（ch61）、Session/Context snapshot-restore 思想（ch11）

## 演示建议

演示 v13 → v14 后可恢复回 v13，并对比两版本差异。

## 遗留矛盾

会回滚了，但「会修改会回滚」不等于「会变好」——如何证明修改有效？

## 验收清单

- [ ] 正文撰写
- [ ] 最小示例与可复现的演示命令
- [ ] 对应 Git Tag `v62-rollback`