---
title: "44 · 复用现有 Tool Registry"
description: "Programmatic Adapter → ToolRegistry：read/write/edit/bash/git 无需重新实现，只加一层 programmatic binding。"
gitTag: "v44-programmatic-binding"
stage: 5
---

# 44 · 复用现有 Tool Registry

> <span class="stage-badge">Stage Hello Programmatic Agent</span> · <span class="tag-badge">v44-programmatic-binding</span> · <span class="stage-badge">规划中</span>

## 本章目标

把 ch43 的「程序里能调能力」落地为对已有 Tool Registry 的薄包装，而不是重新实现一套工具：

```ts
class ProgrammaticToolBinding {
  constructor(private registry: ToolRegistry) {}

  async call(name: string, args: unknown) {
    return this.registry.execute({ name, arguments: args });
  }
}
```

模型看到的 `await read(...) / await write(...) / await bash(...)`，实际跨桥调用：

```text
Python → Bridge → ProgrammaticToolBinding → ToolRegistry → Permission → Tool.execute()
```

> 关键结论：`read/write/edit/bash/git` 不需要重新实现——只是给已有 Harness Capability 增加一层 programmatic binding。

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

- **ToolRegistry**（ch10）、全部已有 Tool、Workspace（ch23）

## 演示建议

程序里调用 `await read("src/index.ts")`，验证与直接执行 read Tool 产生完全相同的输出与事件。

## 遗留矛盾

编程面只能调用「已注册的 Tool」，单次能力粒度仍等同 ToolCall——治理是否仍然跟在每次能力调用后面？

## 验收清单

- [ ] 正文撰写
- [ ] 最小示例与可复现的演示命令
- [ ] 对应 Git Tag `v44-programmatic-binding`