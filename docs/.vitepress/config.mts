/// <reference types="node" />
import { defineConfig } from "vitepress";
import { withMermaid } from "vitepress-plugin-mermaid";

const docsBase = process.env.DOCS_BASE_PATH ?? "/";

const githubRepoLink = "https://github.com/liuyueyi/hello-harness";

const socialLinks = [
  { icon: "github", link: githubRepoLink },
] as const;

const brandLogo =
  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="%236889A0" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6h16M4 12h10M4 18h16" /></svg>';

// ---------- 章节数据 ----------

const stage0Chapters = [
  { text: "00 · 项目初始化", link: "/zh/tutorials/stage-0-hello-llm/00-project-setup" },
  { text: "01 · 第一次调用模型", link: "/zh/tutorials/stage-0-hello-llm/01-first-model-call" },
  { text: "02 · Messages 是什么", link: "/zh/tutorials/stage-0-hello-llm/02-messages" },
  { text: "03 · Streaming", link: "/zh/tutorials/stage-0-hello-llm/03-streaming" },
  { text: "04 · Model Provider 抽象", link: "/zh/tutorials/stage-0-hello-llm/04-provider-abstraction" },
];

const stage1Chapters = [
  { text: "05 · Function Calling", link: "/zh/tutorials/stage-1-hello-agent/05-function-calling" },
  { text: "06 · 第一个 Tool", link: "/zh/tutorials/stage-1-hello-agent/06-first-tool" },
  { text: "07 · Tool Result", link: "/zh/tutorials/stage-1-hello-agent/07-tool-result" },
  { text: "08 · 第一个 Agent Loop", link: "/zh/tutorials/stage-1-hello-agent/08-first-agent-loop" },
  { text: "09 · Agent 的停止条件", link: "/zh/tutorials/stage-1-hello-agent/09-stop-condition" },
];

const stage2Chapters = [
  { text: "10 · Tool Registry", link: "/zh/tutorials/stage-2-hello-harness/10-tool-registry" },
  { text: "11 · Context", link: "/zh/tutorials/stage-2-hello-harness/11-context" },
  { text: "12 · Agent Runtime", link: "/zh/tutorials/stage-2-hello-harness/12-agent-runtime" },
  { text: "13 · Agent Step", link: "/zh/tutorials/stage-2-hello-harness/13-agent-step" },
  { text: "14 · Run", link: "/zh/tutorials/stage-2-hello-harness/14-run" },
  { text: "15 · Event System", link: "/zh/tutorials/stage-2-hello-harness/15-event-system" },
  { text: "16 · Error Model", link: "/zh/tutorials/stage-2-hello-harness/16-error-model" },
  { text: "17 · Abort / Timeout / Retry", link: "/zh/tutorials/stage-2-hello-harness/17-abort-timeout-retry" },
  { text: "18 · Hello Harness v1.0", link: "/zh/tutorials/stage-2-hello-harness/18-hello-minimal-harness" },
];

const stage3Chapters = [
  { text: "19 · Read Tool", link: "/zh/tutorials/stage-3-hello-coding-agent/19-read-tool" },
  { text: "20 · Write Tool", link: "/zh/tutorials/stage-3-hello-coding-agent/20-write-tool" },
  { text: "21 · Edit Tool", link: "/zh/tutorials/stage-3-hello-coding-agent/21-edit-tool" },
  { text: "22 · Bash Tool", link: "/zh/tutorials/stage-3-hello-coding-agent/22-bash-tool" },
  { text: "23 · Workspace", link: "/zh/tutorials/stage-3-hello-coding-agent/23-workspace" },
  { text: "24 · System Prompt", link: "/zh/tutorials/stage-3-hello-coding-agent/24-system-prompt" },
  { text: "25 · CLI", link: "/zh/tutorials/stage-3-hello-coding-agent/25-cli" },
  { text: "26 · Multi-turn Session", link: "/zh/tutorials/stage-3-hello-coding-agent/26-multi-turn-session" },
  { text: "27 · Session 持久化", link: "/zh/tutorials/stage-3-hello-coding-agent/27-session-persistence" },
  { text: "28 · Resume", link: "/zh/tutorials/stage-3-hello-coding-agent/28-resume" },
];

const stage4Chapters = [
  { text: "29 · 为什么 Core 应该保持小", link: "/zh/tutorials/stage-4-hello-pi/29-small-core" },
  { text: "30 · Extension API", link: "/zh/tutorials/stage-4-hello-pi/30-extension-api" },
  { text: "31 · Extension 注册 Tool", link: "/zh/tutorials/stage-4-hello-pi/31-extension-register-tool" },
  { text: "32 · Extension 注册 Hook", link: "/zh/tutorials/stage-4-hello-pi/32-extension-register-hook" },
  { text: "33 · Prompt Extension", link: "/zh/tutorials/stage-4-hello-pi/33-prompt-extension" },
  { text: "34 · Skill", link: "/zh/tutorials/stage-4-hello-pi/34-skill" },
  { text: "35 · Skill Loader", link: "/zh/tutorials/stage-4-hello-pi/35-skill-loader" },
  { text: "36 · Skill Injection", link: "/zh/tutorials/stage-4-hello-pi/36-skill-injection" },
  { text: "37 · Permission Gate", link: "/zh/tutorials/stage-4-hello-pi/37-permission-gate" },
  { text: "38 · Package / Plugin", link: "/zh/tutorials/stage-4-hello-pi/38-package-plugin" },
  { text: "39 · TUI", link: "/zh/tutorials/stage-4-hello-pi/39-tui" },
  { text: "40 · Hello Pi-style Harness", link: "/zh/tutorials/stage-4-hello-pi/40-hello-pi-style-harness" },
];

const stage5Chapters = [
  { text: "42 · Tool Calling 的组合成本", link: "/zh/tutorials/stage-5-hello-programmatic-agent/42-tool-calling-cost" },
  { text: "43 · Code as Action", link: "/zh/tutorials/stage-5-hello-programmatic-agent/43-code-as-action" },
  { text: "44 · 复用现有 Tool Registry", link: "/zh/tutorials/stage-5-hello-programmatic-agent/44-programmatic-binding" },
  { text: "45 · Permission / Event / Error 仍然有效", link: "/zh/tutorials/stage-5-hello-programmatic-agent/45-programmatic-governance" },
  { text: "46 · Executable Skills", link: "/zh/tutorials/stage-5-hello-programmatic-agent/46-executable-skill" },
  { text: "47 · Agent as Function", link: "/zh/tutorials/stage-5-hello-programmatic-agent/47-agent-function" },
  { text: "48 · Recursive Agent", link: "/zh/tutorials/stage-5-hello-programmatic-agent/48-recursive-agent" },
  { text: "49 · Parallel Agents", link: "/zh/tutorials/stage-5-hello-programmatic-agent/49-parallel-agent" },
  { text: "50 · Persistent Working State", link: "/zh/tutorials/stage-5-hello-programmatic-agent/50-persistent-state" },
  { text: "51 · RLM：把 Harness 当作可编程环境", link: "/zh/tutorials/stage-5-hello-programmatic-agent/51-rlm" },
];

const stage6Chapters = [
  { text: "52 · Harness Core 与 Harness State", link: "/zh/tutorials/stage-6-hello-continual-harness/52-harness-core-state" },
  { text: "53 · Harness State Store", link: "/zh/tutorials/stage-6-hello-continual-harness/53-harness-state-store" },
  { text: "54 · Programmatic Harness State API", link: "/zh/tutorials/stage-6-hello-continual-harness/54-programmatic-state-api" },
  { text: "55 · Memory as Harness State", link: "/zh/tutorials/stage-6-hello-continual-harness/55-memory-harness-state" },
  { text: "56 · 从 Run 提炼 Experience", link: "/zh/tutorials/stage-6-hello-continual-harness/56-experience-extraction" },
  { text: "57 · Agent Generated Skill", link: "/zh/tutorials/stage-6-hello-continual-harness/57-agent-generated-skill" },
  { text: "58 · Prompt / Agent Profile Proposal", link: "/zh/tutorials/stage-6-hello-continual-harness/58-prompt-agent-profile-proposal" },
  { text: "59 · Unified Harness Mutation", link: "/zh/tutorials/stage-6-hello-continual-harness/59-unified-harness-mutation" },
  { text: "60 · Mutation Policy", link: "/zh/tutorials/stage-6-hello-continual-harness/60-mutation-policy" },
  { text: "61 · Harness State Versioning", link: "/zh/tutorials/stage-6-hello-continual-harness/61-harness-state-versioning" },
  { text: "62 · Rollback", link: "/zh/tutorials/stage-6-hello-continual-harness/62-rollback" },
  { text: "63 · Hello Continual Harness", link: "/zh/tutorials/stage-6-hello-continual-harness/63-hello-continual-harness" },
];

const stage7Chapters = [
  { text: "64 · Continual ≠ Improving", link: "/zh/tutorials/stage-7-hello-agent-lab/64-continual-vs-improving" },
  { text: "65 · Eval Task", link: "/zh/tutorials/stage-7-hello-agent-lab/65-eval-task" },
  { text: "66 · Verifier", link: "/zh/tutorials/stage-7-hello-agent-lab/66-verifier" },
  { text: "67 · Run Metrics", link: "/zh/tutorials/stage-7-hello-agent-lab/67-run-metrics" },
  { text: "68 · Eval Suite", link: "/zh/tutorials/stage-7-hello-agent-lab/68-eval-suite" },
  { text: "69 · Baseline vs Candidate", link: "/zh/tutorials/stage-7-hello-agent-lab/69-baseline-candidate" },
  { text: "70 · Harness Candidate", link: "/zh/tutorials/stage-7-hello-agent-lab/70-harness-candidate" },
  { text: "71 · Evaluate Harness Mutation", link: "/zh/tutorials/stage-7-hello-agent-lab/71-evaluate-mutation" },
  { text: "72 · Regression Gate", link: "/zh/tutorials/stage-7-hello-agent-lab/72-regression-gate" },
  { text: "73 · Promote / Reject", link: "/zh/tutorials/stage-7-hello-agent-lab/73-promote-reject" },
  { text: "74 · Failure Analysis", link: "/zh/tutorials/stage-7-hello-agent-lab/74-failure-analysis" },
  { text: "75 · Improvement Loop", link: "/zh/tutorials/stage-7-hello-agent-lab/75-improvement-loop" },
  { text: "76 · Hello Self-Improving Harness", link: "/zh/tutorials/stage-7-hello-agent-lab/76-hello-self-improving-harness" },
];

const zhNav = [
  { text: "首页", link: "/zh/", activeMatch: "^/zh/?$" },
  { text: "教程", link: "/zh/tutorials/", activeMatch: "^/zh/tutorials/" },
  { text: "概览", link: "/zh/overview/", activeMatch: "^/zh/overview/" },
  { text: "资源", link: "/zh/resources/", activeMatch: "^/zh/resources/" },
  { text: "Skills", link: "/zh/skills/", activeMatch: "^/zh/skills/" },
  { text: "GitHub", link: githubRepoLink, target: "_blank", rel: "noopener noreferrer" },
];

const zhSidebar = {
  "/zh/tutorials/": [
    { text: "教程地图", link: "/zh/tutorials/", items: [{ text: "地图与里程碑", link: "/zh/tutorials/" }] },
    { text: "Stage 0 · Hello LLM", collapsed: false, items: stage0Chapters },
    { text: "Stage 1 · Hello Agent", collapsed: false, items: stage1Chapters },
    { text: "Stage 2 · Hello Harness", collapsed: false, items: stage2Chapters },
    { text: "Stage 3 · Hello Coding Agent", collapsed: false, items: stage3Chapters },
    { text: "Stage 4 · Hello Pi", collapsed: false, items: stage4Chapters },
    { text: "Stage 5 · Hello Programmatic Agent", collapsed: false, items: stage5Chapters },
    { text: "Stage 6 · Hello Continual Harness", collapsed: false, items: stage6Chapters },
    { text: "Stage 7 · Hello Agent Lab", collapsed: false, items: stage7Chapters },
  ],
  "/zh/overview/": [
    {
      text: "项目概览",
      items: [
        { text: "关于本项目", link: "/zh/overview/" },
        { text: "演进路线", link: "/zh/overview/roadmap" },
        { text: "贯穿案例", link: "/zh/overview/cases" },
      ],
    },
  ],
  "/zh/resources/": [
    {
      text: "资源",
      items: [
        { text: "参考资料", link: "/zh/resources/" },
      ],
    },
  ],
  "/zh/skills/": [
    {
      text: "Skills",
      items: [
        { text: "仓库级 Skills", link: "/zh/skills/" },
      ],
    },
  ],
  "/zh/": [
    {
      text: "Hello Harness",
      items: [
        { text: "首页", link: "/zh/" },
        { text: "教程地图", link: "/zh/tutorials/" },
        { text: "项目概览", link: "/zh/overview/" },
        { text: "演进路线", link: "/zh/overview/roadmap" },
        { text: "贯穿案例", link: "/zh/overview/cases" },
        { text: "参考资料", link: "/zh/resources/" },
      ],
    },
  ],
};

const enSidebar = {
  "/en/": [
    {
      text: "Hello Harness",
      items: [
        { text: "Home", link: "/en/" },
      ],
    },
  ],
};

export default withMermaid(
  defineConfig({
    base: docsBase,
    title: "Hello Harness",
    description:
      "从 0 到 1 构建现代 Coding Agent Harness：从 Agent Loop 到 Self-Improving Harness，亲手实现现代 Coding Agent 的核心架构。",
    cleanUrls: true,
    ignoreDeadLinks: true,
    head: [
      ["link", { rel: "icon", type: "image/svg+xml", href: brandLogo }],
      ["link", { rel: "stylesheet", href: "https://cdn.jsdelivr.net/npm/gitalk/dist/gitalk.css" }],
    ],
    themeConfig: {
      logo: brandLogo,
      search: {
        provider: "local",
      },
      socialLinks,
      gitalk: {
        clientID: "Ov23libXsrlvSFanb0dD",
        clientSecret: "22d6d58b32b2105e59f8c21cc3af609a00e1aad2",
        repo: "hello-harness",
        owner: "liuyueyi",
        admin: ["liuyueyi"],
      },
    },
    vite: {
      optimizeDeps: {
        include: ["dayjs"],
      },
    },
    markdown: {
      theme: {
        light: "github-light",
        dark: "github-dark",
      },
    },
    mermaid: {
      theme: "base",
      themeVariables: {
        primaryColor: "#eef2f6",
        primaryBorderColor: "#b8c7d3",
        primaryTextColor: "#1a2634",
        lineColor: "#94a8b8",
        fontFamily: "Inter, sans-serif",
        fontSize: "16px",
      },
      flowchart: {
        nodeSpacing: 40,
        rankSpacing: 56,
        padding: 12,
      },
    },
    locales: {
      zh: {
        label: "简体中文",
        lang: "zh-CN",
        link: "/zh/",
        themeConfig: {
          nav: zhNav,
          sidebar: zhSidebar,
          outline: {
            level: [2, 3],
            label: "本页目录",
          },
          docFooter: {
            prev: "上一页",
            next: "下一页",
          },
          lastUpdated: {
            text: "最后更新",
          },
          returnToTopLabel: "回到顶部",
          sidebarMenuLabel: "菜单",
          darkModeSwitchLabel: "主题",
          lightModeSwitchTitle: "切换到浅色模式",
          darkModeSwitchTitle: "切换到深色模式",
        },
      },
      en: {
        label: "English",
        lang: "en-US",
        link: "/en/",
        themeConfig: {
          nav: [
            { text: "Home", link: "/en/" },
            { text: "GitHub", link: githubRepoLink, target: "_blank", rel: "noopener noreferrer" },
          ],
          sidebar: enSidebar,
        },
      },
    },
  }),
);
