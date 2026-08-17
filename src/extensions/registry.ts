import { RuntimeError } from "../core/errors/errors";
import type { Extension } from "./extension";

export interface InstalledExtension {
  name: string;
  version?: string;
  description?: string;
  status: "active";
}

export interface ExtensionRegistryOptions {
  log?: (name: string, message: string) => void;
}

export class ExtensionRegistry {
  private readonly extensions = new Map<string, Extension>();
  private readonly log: (name: string, message: string) => void;

  constructor(options: ExtensionRegistryOptions = {}) {
    this.log = options.log ?? ((name, message) => console.log(`[ext:${name}] ${message}`));
  }

  install(extension: Extension): void {
    const name = extension.name;
    if (typeof name !== "string" || name.trim() === "") {
      throw new RuntimeError("扩展名不能为空");
    }
    if (this.extensions.has(name)) {
      throw new RuntimeError(`扩展 ${name} 已注册`);
    }
    extension.setup({ name, log: (message) => this.log(name, message) });
    this.extensions.set(name, extension);
  }

  get(name: string): Extension | undefined {
    return this.extensions.get(name);
  }

  list(): InstalledExtension[] {
    return [...this.extensions.values()].map((extension) => ({
      name: extension.name,
      version: extension.version,
      description: extension.description,
      status: "active",
    }));
  }
}
