import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { Workspace } from "../workspace/workspace";
import type { SessionSnapshot } from "./session";

export interface SessionMeta {
  id: string;
  savedAt: number;
}

export interface SessionRecord extends SessionSnapshot {
  savedAt: number;
}

export class SessionStore {
  constructor(
    private readonly workspace: Workspace,
    private readonly dirName: string = ".sessions",
  ) {}

  private sessionPath(id: string): string {
    if (!/^[0-9a-fA-F-]{1,64}$/.test(id)) {
      throw new Error(`非法 session id：${id}`);
    }
    return path.join(this.dirName, `${id}.json`);
  }

  async save(snapshot: SessionSnapshot): Promise<void> {
    const record: SessionRecord = { ...snapshot, savedAt: Date.now() };
    await this.workspace.write(this.sessionPath(snapshot.id), JSON.stringify(record, null, 2));
  }

  async load(id: string): Promise<SessionRecord | null> {
    const filePath = this.sessionPath(id);
    if (!(await this.workspace.exists(filePath))) return null;
    const raw = await this.workspace.read(filePath);
    return JSON.parse(raw) as SessionRecord;
  }

  async list(): Promise<SessionMeta[]> {
    const dir = this.workspace.resolve(this.dirName, "访问会话目录");
    const entries = await readdir(dir).catch(() => [] as string[]);
    const metas: SessionMeta[] = [];
    for (const name of entries) {
      if (!name.endsWith(".json")) continue;
      const raw = await readFile(path.join(dir, name), "utf-8").catch(() => null);
      if (!raw) continue;
      const parsed = JSON.parse(raw) as SessionRecord;
      metas.push({ id: parsed.id, savedAt: parsed.savedAt });
    }
    return metas.sort((a, b) => b.savedAt - a.savedAt);
  }
}