export type ErrorKind = "model" | "tool" | "runtime" | "context" | "permission";

export abstract class HarnessError extends Error {
  abstract readonly kind: ErrorKind;
  abstract readonly retryable: boolean;

  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class ModelError extends HarnessError {
  readonly kind: ErrorKind = "model";
  readonly retryable: boolean = true;
}

export class ToolError extends HarnessError {
  readonly kind: ErrorKind = "tool";
  readonly retryable: boolean = false;
}

export class RuntimeError extends HarnessError {
  readonly kind: ErrorKind = "runtime";
  readonly retryable: boolean = true;
}

export class ContextError extends HarnessError {
  readonly kind: ErrorKind = "context";
  readonly retryable: boolean = false;
}

export class PermissionError extends HarnessError {
  readonly kind: ErrorKind = "permission";
  readonly retryable: boolean = false;
}

export function toHarnessError(error: unknown, fallbackKind: ErrorKind = "runtime"): HarnessError {
  if (error instanceof HarnessError) {
    return error;
  }
  const message = error instanceof Error ? error.message : String(error);
  switch (fallbackKind) {
    case "model":
      return new ModelError(message);
    case "tool":
      return new ToolError(message);
    case "context":
      return new ContextError(message);
    case "permission":
      return new PermissionError(message);
    default:
      return new RuntimeError(message);
  }
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}