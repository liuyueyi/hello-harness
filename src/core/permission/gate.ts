import type { ToolCall } from "../model/types";

export type PermissionDecision =
  | { action: "allow"; reason?: string }
  | { action: "deny"; reason: string }
  | { action: "ask"; reason: string };

export interface PermissionPolicy {
  readonly name: string;
  readonly description: string;
  check(call: ToolCall): PermissionDecision;
}

export type AskResolver = (call: ToolCall, reason: string) => Promise<boolean>;

export interface PermissionCheck {
  allowed: boolean;
  decision: PermissionDecision;
}

export class PermissionGate {
  private readonly policies: PermissionPolicy[] = [];
  private askResolver?: AskResolver;

  add(policy: PermissionPolicy): void {
    this.policies.push(policy);
  }

  setAsk(resolver: AskResolver): void {
    this.askResolver = resolver;
  }

  list(): PermissionPolicy[] {
    return [...this.policies];
  }

  async decide(call: ToolCall): Promise<PermissionDecision> {
    for (const policy of this.policies) {
      const decision = policy.check(call);
      if (decision.action === "deny" || decision.action === "ask") return decision;
      if (decision.action === "allow" && decision.reason !== undefined) return decision;
    }
    return { action: "allow" };
  }

  async check(call: ToolCall): Promise<PermissionCheck> {
    const decision = await this.decide(call);
    if (decision.action === "deny") return { allowed: false, decision };
    if (decision.action === "ask") {
      const granted = this.askResolver ? await this.askResolver(call, decision.reason) : false;
      if (!granted) return { allowed: false, decision };
    }
    return { allowed: true, decision };
  }
}
