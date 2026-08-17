import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { RuntimeError } from "../core/errors/errors";

export interface Prompt {
  name: string;
  content: string;
}

export class PromptRegistry {
  private readonly prompts = new Map<string, Prompt>();

  register(prompt: Prompt): void {
    const name = prompt.name;
    if (typeof name !== "string" || name.trim() === "") {
      throw new RuntimeError("提示词名称不能为空");
    }
    if (this.prompts.has(name)) {
      throw new RuntimeError(`提示词 ${name} 已注册`);
    }
    this.prompts.set(name, prompt);
  }

  get(name: string): Prompt | undefined {
    return this.prompts.get(name);
  }

  list(): Prompt[] {
    return [...this.prompts.values()];
  }
}

export class PromptLoader {
  constructor(private readonly dir: string) {}

  loadSync(): Prompt[] {
    let entries: string[];
    try {
      entries = readdirSync(this.dir);
    } catch {
      return [];
    }
    return entries
      .filter((entry) => entry.endsWith(".md"))
      .sort()
      .map((entry) => {
        const file = path.join(this.dir, entry);
        const content = readFileSync(file, "utf-8");
        return { name: entry.slice(0, -3), content };
      });
  }
}
