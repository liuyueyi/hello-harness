---
title: 参考资料
---

# 参考资料

## 权威参考

- [OpenAI: Harness engineering: leveraging Codex in an agent-first world](https://openai.com/index/harness-engineering/)
- [Anthropic: Effective harnesses for long-running agents](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents)
- [Anthropic: Harness design for long-running application development](https://www.anthropic.com/engineering/harness-design-long-running-apps)
- [Awesome Harness Engineering](https://github.com/walkinglabs/awesome-harness-engineering)
- [Prime Agent: A self-improving RLM agent](https://www.primeintellect.ai/blog/prime-agent)

## 技术约定

> 首次引入语言、包管理器、测试框架或构建工具时，选择应服务于「读者易运行、每章可独立理解」的目标。

当前约定：

- **语言**：TypeScript
- **运行时**：Node.js
- **包管理器**：pnpm
- **文档站点**：VitePress（源码位于 `docs/`，输出位于 `docs/.vitepress/dist`）

## 开发命令

```bash
# 本地预览文档站点
npm run docs:dev

# 构建文档站点
npm run docs:build
npm run docs:preview
```

## 凭据约定

不提交密钥。通过环境变量与示例配置文件（如 `.env.example`）处理模型 Provider 凭据。

## 质量控制

- 行为变化优先测试；命令行或教程行为优先提供可复制的 demo。
- 每个里程碑对应一个 Git Tag，可直接检出阅读。