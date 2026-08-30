# AGENTS.md

## 项目使命

`hello-harness` 是一个从零构建现代 Coding Agent Harness 的教育型项目。它不旨在封装另一个黑盒 Agent Framework，而是以小而可读、可运行、可验证的实现，展示 Harness 如何逐步演进：

```text
LLM → Tool-Calling Agent → Extensible Coding Harness
    → Runtime-oriented / RLM Harness → Recursive Harness
    → Continual / Self-Improving Harness → Agent Lab
```

产品路线与教程大纲是本仓库的事实来源：

- `plan/产品路线.md`：产品定位、架构思想与长期演进方向。
- `plan/教程规划.md`：Stage 0–7、章节编号、示例与 Git Tag 规划。

在实现、重构或新增文档前，先检查并遵循这两份规划；若实现与规划冲突，应更新规划或在变更说明中明确原因。

## 工作原则

1. **先教学，后抽象。** 每次演进只引入解决当前问题所需的最小概念；不要为了“未来可能需要”而过早设计。
2. **核心保持小且可读。** `core` 的职责和依赖必须克制。优先清晰、可跟读的代码，而不是一次性追求完备功能。
3. **每章都可运行和验证。** 新增功能应配套最小示例、测试或可复现的命令；读者应能从对应 Git Tag 检出该章节最终状态。
4. **保持演进叙事。** 每一章应说明：上一版本的限制、本章解决的问题、架构变化、最小实现、演示、引入的新限制，以及下一章为何必要。
5. **不隐瞒复杂性。** 并发、权限、失败、上下文、持久化和自我改进都需要明确边界与可观察性，不能用“魔法”掩盖。

## 架构边界（必须遵守）

- **Model 不知道 Agent。** Model 层只负责 provider 无关的输入/输出与流式响应。
- **Tool 不知道 Agent。** Tool 只处理 `input → environment → output`，不耦合循环、消息历史或具体模型。
- **Runtime 不绑定 Provider。** Runtime、Context、Session、Event 和 Capability 层必须能独立于 OpenAI、Anthropic、Gemini 或本地模型演进。
- **Core 与可演进状态隔离。** Continual 阶段允许 Agent 提议或更新 Prompt、Skill、Memory、Agent Config 与策略；不得允许其任意写入或破坏 Core。
- **所有可变更必须受控。** Harness mutation 遵循 `propose → validate → apply → version → rollback`，并保留可审计记录。
- **Capability 优于 Tool 膨胀。** 在 RLM 阶段，优先通过受控的 Runtime 能力组合文件、Shell、搜索、Git、MCP、Skill 与子 Agent；不要无限增加平铺 JSON Tool。

## 建议目录与职责

目录会随教程逐步生长；新增代码时优先向下列目标结构靠拢，避免把全部逻辑堆进单个 `src/`：

```text
packages/
  core/            # model、context、runtime、events、session 等最小抽象
  tools/           # fs、shell、git 等环境能力
  coding-agent/    # 面向代码任务的组装层
  extensions/      # extension / hook / plugin
  skills/          # skill 定义、加载与注入
  programmatic/    # code-as-action、programmatic binding、persistent working state
  recursive/       # agent-as-function、subagent、agent tree
  continual/       # harness state、memory、mutation、versioning
  eval/            # task、trajectory、verifier、reward、regression
  cli/             # CLI / TUI
examples/          # 与章节对应的最小可运行示例
tutorials/         # 教程正文
docs/              # 架构与设计文档
benchmarks/        # 任务集、评测和回归数据
skills/            # 仓库级可复用技能
```

> **说明（v40 结构落地）**：Stage 4 收官时 `src/` 已整体迁入 `packages/` 五个正式包（见 `plan/教程规划.md` ch40）——`core`（六件套+errors+permission gate）、`extensions`（Extension 契约/Registry/PackageLoader + Prompt/Skill 注册表，skills 当前并入此处）、`coding`（Workspace+工具+权限策略+hello-coding，tools 当前并入此处）、`ai`（大模型提供者实现，如 OpenAI 适配器；cli 不绑定具体模型）、`cli`（入口/render/chat/TUI）。第三方插件实现（git/web）放仓库根 `plugins/`，不混入 `packages/`。后续阶段的 `programmatic/`、`recursive/`、`continual/`、`eval/` 等按目标结构继续生长，必要时再把 tools/skills 拆出独立包。

> **说明（站点结构变更）**：教程正文统一放在 `docs/zh/tutorials/`，`docs/` 同时是整个项目文档站点的源码根（VitePress），通过 GitHub Actions + GitHub Pages 发布。章节按 Stage 组织：`docs/zh/tutorials/stage-{n}-{name}/` 下每章一个 md 文件，文件名为 `NN-slug.md`（`NN` 为章节号，与 Git Tag `vNN-*` 一一对应）。站点首页 `docs/zh/index.md`，教程地图 `docs/zh/tutorials/index.md`，部署工作流 `.github/workflows/deploy-pages.yml`。

本地开发命令：`pnpm docs:dev`（预览）、`pnpm docs:build`（构建，输出 `docs/.vitepress/dist`）。教程代码入口是 `pnpm dev`（运行 `packages/cli/src/main.ts`），类型检查为 `pnpm typecheck`。

这是目标方向，不要求在项目初始化阶段创建空目录或伪实现。

## 实现约定

- 首次引入语言、包管理器、测试框架或构建工具时，选择应服务于“读者易运行、每章可独立理解”的目标，并在 README 中记录。
- 保持公开 API 小而稳定；优先用接口表达边界，例如 `Model`、`Tool`、`Runtime`、`Verifier` 与 `HarnessMutation`。
- 运行中的每一步应可观察：至少能获得步骤、输入/输出摘要、错误、耗时以及取消状态；进入 Agent Lab 后还应记录 token、成本和 trajectory。
- 代码变更应包含与风险相称的验证。行为变化优先测试；命令行或教程行为优先提供可复制的 demo。
- 不提交密钥、真实用户数据、大型模型输出或不可复现的临时产物。通过环境变量与示例配置文件处理凭据。

## 阶段性安全规则

- 文件与 Shell 能力默认限定在显式 workspace；禁止静默扩大路径或网络权限。
- 有副作用的操作应通过 Permission Gate，并向模型返回清晰、结构化的拒绝原因。
- 子 Agent 必须继承明确的任务范围、预算、权限与取消机制；不要给予无限递归或无限并发。
- 自我改进只能修改版本化、可回滚的 Harness State；升级候选必须经过验证与回归评测后才能激活。
- “性能提升”必须由可复现评测证明，不能只凭模型自述或单次成功案例。

## 提交与教程里程碑

- 一项章节功能尽量对应一个聚焦提交和一个可检出的 Git Tag。
- Tag 命名沿用 `plan/教程规划.md` 中的序号，例如 `v08-agent-loop`、`v40-pi-style`、`v51-rlm`、`v63-continual-harness`、`v76-self-improving`。
- 不在未完成的早期章节中提前实现后续阶段的核心能力；如需演示，使用隔离的实验目录并明确标注。
