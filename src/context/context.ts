import type { Message } from "../model/messages";

export interface ContextSnapshot {
  readonly messages: readonly Message[];
}

export class AgentContext {
  private _messages: Message[];

  constructor(messages: Message[] = []) {
    this._messages = [...messages];
  }

  get messages(): Message[] {
    return [...this._messages];
  }

  add(message: Message): void {
    this._messages.push(message);
  }

  snapshot(): ContextSnapshot {
    return { messages: [...this._messages] };
  }

  restore(snapshot: ContextSnapshot): void {
    this._messages = [...snapshot.messages];
  }
}