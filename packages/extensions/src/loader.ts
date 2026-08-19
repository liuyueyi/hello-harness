import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { RuntimeError } from "@hello-harness/core";
import type { Extension } from "./extension";

export interface WorkspaceLike {
  readonly root: string;
}

export interface PackageManifest {
  name: string;
  version: string;
  main?: string;
}

export type ExtensionFactory = (workspace: WorkspaceLike) => Extension;

export interface LoadedPackage {
  manifest: PackageManifest;
  entry: string;
  extension: Extension;
}

export class PackageLoader {
  private readonly log: (message: string) => void;

  constructor(log: (message: string) => void = () => {}) {
    this.log = log;
  }

  async load(packageDir: string, workspace: WorkspaceLike): Promise<LoadedPackage> {
    const manifest = await this.readManifest(packageDir);
    const entry = await this.resolveEntry(packageDir, manifest.main);

    let module: unknown;
    try {
      module = await import(pathToFileURL(entry).href);
    } catch (error) {
      throw new RuntimeError(
        `包 ${manifest.name} 入口加载失败：${entry}（${error instanceof Error ? error.message : String(error)}）`,
      );
    }

    const factory = (module as { default?: unknown }).default;
    if (typeof factory !== "function") {
      throw new RuntimeError(
        `包 ${manifest.name} 的入口必须默认导出一个工厂函数（workspace）=> Extension，收到：${typeof factory}`,
      );
    }

    let extension: Extension;
    try {
      extension = factory(workspace) as Extension;
    } catch (error) {
      throw new RuntimeError(
        `包 ${manifest.name} 的工厂执行失败（${error instanceof Error ? error.message : String(error)}）`,
      );
    }
    if (typeof extension?.name !== "string" || typeof extension.setup !== "function") {
      throw new RuntimeError(`包 ${manifest.name} 的工厂没有返回合法的 Extension（需要 name + setup）`);
    }

    this.log(`已加载包：${manifest.name}@${manifest.version}（入口 ${path.basename(entry)}）`);
    return { manifest, entry, extension };
  }

  private async readManifest(packageDir: string): Promise<PackageManifest> {
    const manifestPath = path.join(packageDir, "package.json");
    let raw: string;
    try {
      raw = await readFile(manifestPath, "utf-8");
    } catch (error) {
      throw new RuntimeError(
        `读取包清单失败：${manifestPath}（${error instanceof Error ? error.message : String(error)}）`,
      );
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (error) {
      throw new RuntimeError(
        `包清单不是合法 JSON：${manifestPath}（${error instanceof Error ? error.message : String(error)}）`,
      );
    }

    const manifest = parsed as Partial<PackageManifest>;
    if (typeof manifest.name !== "string" || manifest.name.trim() === "") {
      throw new RuntimeError(`包清单缺少合法 name：${manifestPath}`);
    }
    if (typeof manifest.version !== "string" || manifest.version.trim() === "") {
      throw new RuntimeError(`包清单缺少合法 version：${manifestPath}`);
    }
    return { name: manifest.name, version: manifest.version, main: manifest.main };
  }

  private async resolveEntry(packageDir: string, main: string | undefined): Promise<string> {
    const entry = path.resolve(packageDir, main ?? "index.ts");
    const info = await stat(entry).catch(() => null);
    if (info === null || !info.isFile()) {
      throw new RuntimeError(`包入口不存在：${entry}`);
    }
    return entry;
  }
}
