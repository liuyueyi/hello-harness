import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { PermissionError } from "@hello-harness/core";

export class Workspace {
  readonly root: string;

  constructor(root: string) {
    this.root = path.resolve(root);
  }

  resolve(filePath: string, verb = "访问"): string {
    const target = path.resolve(this.root, filePath);
    if (target !== this.root && !target.startsWith(this.root + path.sep)) {
      throw new PermissionError(`路径超出 workspace 范围，拒绝${verb}：${filePath}（解析后 ${target}）`);
    }
    return target;
  }

  async exists(filePath: string): Promise<boolean> {
    const info = await stat(this.resolve(filePath)).catch(() => null);
    return info !== null;
  }

  async isFile(filePath: string): Promise<boolean> {
    const info = await stat(this.resolve(filePath)).catch(() => null);
    return info !== null && info.isFile();
  }

  async read(filePath: string): Promise<string> {
    const target = this.resolve(filePath);
    await stat(target);
    return readFile(target, "utf-8");
  }

  async write(filePath: string, content: string): Promise<void> {
    const target = this.resolve(filePath);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, content, "utf-8");
  }
}
