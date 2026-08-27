#!/usr/bin/env bash
# 48 Context as Variable — 真实模型交互演示脚本
# 运行前请配置环境变量：
#   export OPENAI_BASE_URL=https://api.openai.com/v1   # 或你的兼容端点
#   export OPENAI_API_KEY=sk-xxx
#   export OPENAI_MODEL=gpt-4o-mini                    # 或你想用的模型

set -euo pipefail

WORKSPACE=$(mktemp -d)
echo "Workspace: $WORKSPACE"

# 准备一个小项目：认证相关代码
cat > "$WORKSPACE/auth.ts" <<'EOF'
export interface User {
  id: string;
  name: string;
  role: "admin" | "user";
}

export function checkAuth(user: User, requiredRole: "admin" | "user"): boolean {
  // admin 拥有所有权限
  if (user.role === "admin") return true;
  // user 只能访问 user 级资源
  return user.role === requiredRole;
}

export function getUserPermissions(user: User): string[] {
  if (user.role === "admin") return ["read", "write", "delete", "admin"];
  return ["read"];
}
EOF

cat > "$WORKSPACE/api.ts" <<'EOF'
import { checkAuth, getUserPermissions } from "./auth";

export interface RequestContext {
  user: User;
  action: string;
}

export function handleRequest(ctx: RequestContext): { ok: boolean; data?: unknown; error?: string } {
  if (!checkAuth(ctx.user, "admin")) {
    return { ok: false, error: "forbidden: admin required" };
  }
  const perms = getUserPermissions(ctx.user);
  return { ok: true, data: { action: ctx.action, permissions: perms } };
}
EOF

cat > "$WORKSPACE/user.ts" <<'EOF'
import { User } from "./auth";

// 模拟当前登录用户
export const currentUser: User = {
  id: "u-123",
  name: "Alice",
  role: "user",  // 不是 admin
};
EOF

echo "=== 项目结构 ==="
tree "$WORKSPACE" || find "$WORKSPACE" -type f | sort

echo ""
echo "=== 启动命令 ==="
echo "cd $WORKSPACE && pnpm dev -- --chat --code-runtime python --code-capabilities"
echo ""
echo "=== 试着问这些问题（展示 Context as Variable 效果） ==="
cat <<'PROMPTS'
1. 搜一下上下文里有没有提到 checkAuth
   → 模型应调用 context.search("checkAuth")，得到结果后再决定是否读文件

2. 刚才搜到的 checkAuth 在哪个文件里？帮我读一下完整内容
   → 模型用 context.slice() 看最近对话，或再次 search，然后 fs.read

3. 当前上下文一共有多少轮对话？Runtime 里攒了哪些变量？
   → 模型调用 context.summarize() 获取概览

4. 我不记得刚才让你读了哪个文件，帮我查一下最近 3 轮的对话记录
   → 模型用 context.slice(-3, None) 切片

5. 把 auth.ts 里的 checkAuth 改成：user 也可以访问 admin 资源（演示权限门）
   → 模型用 fs.read 读文件 → 修改 → fs.write 写回 → 用 code_action 验证

6. 清空内核状态，重新开始（演示 reset 边界）
   → 你可以在代码里写 `import context; context.getRuntimeState()` 但这会死锁，
     正确做法是看工具回包里的 state 字段，或让宿主帮你 reset
PROMPTS

echo ""
echo "=== 关键观察点 ==="
cat <<'OBS'
- 每次 code_action 回包都带 state 字段（内核变量清单），模型能看到 Runtime State
- 模型主动调用 context.search/slice/summarize，不再被动等观察推送
- context.current()/getRuntimeState() 在单元格内会死锁（单线程内核），
  模型应通过工具回包的 state 字段获取最新 Runtime State
- 任务切换时应显式 reset（在代码里无法直接 reset，需宿主配合）
OBS

# 清理函数
cleanup() {
  rm -rf "$WORKSPACE"
  echo "Cleaned up $WORKSPACE"
}
trap cleanup EXIT

# 如果提供了 --run 参数，实际启动交互（需要配置好 API Key）
if [[ "${1:-}" == "--run" ]]; then
  cd "$WORKSPACE"
  pnpm dev -- --chat --code-runtime python --code-capabilities
fi