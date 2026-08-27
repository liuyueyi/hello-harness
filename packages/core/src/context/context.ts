import type { Message } from "../model/messages";
import type { ContextFilter, ContextEntry, ContextSearchOptions, ContextSearchResult } from "./search";
import { contextEntries, filterContext, searchContext } from "./search";

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

  /** A position-preserving, serializable view for context-oriented capabilities. */
  entries(): ContextEntry[] {
    return contextEntries(this._messages);
  }

  filter(filter?: ContextFilter): ContextEntry[] {
    return filterContext(this.entries(), filter);
  }

  search(options: ContextSearchOptions): ContextSearchResult {
    return searchContext(this.entries(), options);
  }
}
