import type { Message } from "../model/messages";
import type { ErrorKind } from "../errors/errors";
import type { AgentStep } from "./step";

export type RunStatus = "running" | "completed" | "failed" | "aborted";

export type StopReason = "finished" | "maxSteps" | "timeout" | "aborted" | "failed";

export interface AgentRun {
  id: string;
  input: string;
  status: RunStatus;
  stopReason: StopReason;
  answer: string;
  history: Message[];
  steps: AgentStep[];
  iterations: number;
  inputTokens: number;
  outputTokens: number;
  error?: string;
  errorKind?: ErrorKind;
  startedAt: number;
  endedAt: number;
}
