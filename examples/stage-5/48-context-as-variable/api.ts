import { checkAuth, getUserPermissions, User } from "./auth";

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