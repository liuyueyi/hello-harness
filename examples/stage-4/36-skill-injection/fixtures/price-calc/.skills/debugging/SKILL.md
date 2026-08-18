---
name: debugging
description: 排查本项目（price-calc）报错 / 失败测试时使用：先复现，再逆推，最后用命令验证。
---

# debugging

排查本项目（price-calc）报错 / 失败测试时使用：先复现，再逆推，最后用命令验证。

## 流程
1. 先复现：跑 `npm run repro`（等价 `node --import tsx .skills/debugging/scripts/reproduce.mjs`），拿到失败用例与期望值；
2. read 相关代码，按「输出 → 上游」逆推根因；
3. 修改后先跑一次复现脚本，再 `npm test` 确认全绿无回归。

## 常用命令
- `npm test`：完整测试
- `npm run repro`：最小复现脚本（直接 import 本项目的 price.ts）

## 约束
- 不靠猜：每一处结论都要有运行输出为依据；
- 一次只修一个根因，不顺手重构无关代码；
- 金额计算陷阱对照 `references/金额计算陷阱.md`。
