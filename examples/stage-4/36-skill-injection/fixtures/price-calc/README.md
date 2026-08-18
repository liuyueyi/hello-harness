# price-calc · Skill 测试示例项目

一个小而完整的示例项目，用来端到端测试 ch36 的 skill harness 全链路：
**目录注入 → load_skill 加载 → 技能能力（scripts/references）真实可用 → 修复后回归**。

## 现状（故意带 bug）

`price.ts` 的 `calcPrice` 有一个真实感十足的 bug：`Math.floor(basePrice)` 把价格先取整成整数元，
**分位被吞**——`calcPrice(99.9, 0)` 返回 `99` 而不是 `99.9`。`npm test` 会失败 1 个用例。

## 测试 Skill 全链路

```bash
# 0. 先复现：完整测试确实失败（1 个用例失败）
npm test

# 1. 加载技能：把本项目自己的 .skills/debugging 加载进注册表（在仓库根目录执行）
node --import tsx -e "import { SkillLoader } from './src/skill/loader.ts'; const s = new SkillLoader('examples/stage-4/36-skill-injection/fixtures/price-calc/.skills').loadSync(); console.log(s.map(x => x.name + ' · ' + x.description + ' · scripts=' + x.scripts + ' · references=' + x.references).join('\n'))"

# 2. 按技能走流程：最小复现 → 逆推根因 → 修改 → 回归
npm run repro            # 复现：锁定 calcPrice(99.9, 0) 返回 99

# 3. 修 bug：把 price.ts 里的 Math.floor 那行删掉，直接用 basePrice 折算

# 4. 回归
npm run repro            # 复现脚本全绿
npm test                 # 完整测试全绿
```

## 关键点

技能放在本项目自己的 `.skills/` 里：

- 脚本 `scripts/reproduce.mjs` **直接 import 本项目的 `price.ts`**；
- 资料 `references/金额计算陷阱.md` 讲的是**本项目会踩的坑**；
- 技能 description 指向本项目的命令（`npm test` / `npm run repro`）。

> **技能只有住在它服务的项目里，它的 scripts / references 才真能派上用场**——
> 这正是 ch36「目录披露 → 按需加载 → 能力可用」想要演示的东西。
