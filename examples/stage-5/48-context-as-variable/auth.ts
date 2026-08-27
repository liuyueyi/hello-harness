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
