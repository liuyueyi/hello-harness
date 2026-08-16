import { randomUUID } from "node:crypto";
import type { AgentRuntime } from "../agent/runtime";
import type { AgentRun } from "../agent/run";
import { AgentContext } from "../context/context";
import type { ContextSnapshot } from "../context/context";
import type { Message } from "../model/messages";
import { userMessage } from "../model/messages";

export interface SessionSnapshot {
  id: string;
  context: ContextSnapshot;
}

export class Session {
  readonly id: string;
  readonly context: AgentContext;

  constructor(id: string = randomUUID(), messages: Message[] = []) {
    this.id = id;
    this.context = new AgentContext(messages);
  }

  async turn(runtime: AgentRuntime, prompt: string): Promise<AgentRun> {
    this.context.add(userMessage(prompt));
    return runtime.runContext(this.context);
  }

  snapshot(): SessionSnapshot {
    return { id: this.id, context: this.context.snapshot() };
  }

  restore(snapshot: SessionSnapshot): void {
    this.context.restore(snapshot.context);
  }
}