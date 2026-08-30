---
title: "73 · Promote / Reject"
description: "建立真正的选择机制：Candidate → Evaluation → Regression Gate → Promote / Reject。"
gitTag: "v73-promote-reject"
stage: 7
---

# 73 · Promote / Reject

> <span class="stage-badge">Stage Hello Agent Lab</span> · <span class="tag-badge">v73-promote-reject</span> · <span class="stage-badge">规划中</span>

## 本章目标

建立真正的选择机制：

```text
Candidate → Evaluation → Regression Gate → Promote / Reject
```

> Stage 6 有 Proposal，Stage 7 必须决定哪个 Proposal 能真正进入 Harness State。成功：Candidate → Promote → Harness State v13；失败：Candidate → Reject → Current stays v12。到这里才开始真正具备「进化选择」。

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

- HarnessCandidate（ch70）、RegressionGate（ch72）、版本晋升写入 StateStore（ch61/53）

## 演示建议

让一个合规 Candidate 晋升为新版本，一个退化 Candidate 被拒绝。

## 遗留矛盾

只看到「成功/失败」还不够——失败了要能反推「下一步改什么」。

## 验收清单

- [ ] 正文撰写
- [ ] 最小示例与可复现的演示命令
- [ ] 对应 Git Tag `v73-promote-reject`