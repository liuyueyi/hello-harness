import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { parse } from "yaml";
import type { Skill } from "./skill";

export interface ParsedFrontmatter {
  metadata: Record<string, unknown>;
  content: string;
}

export const SKILL_NAME_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export function parseFrontmatter(text: string): ParsedFrontmatter {
  const lines = text.split(/\r?\n/);
  if (lines[0]?.trim() !== "---") return { metadata: {}, content: text };
  const end = lines.findIndex((line, index) => index > 0 && line.trim() === "---");
  if (end === -1) return { metadata: {}, content: text };
  const yamlText = lines.slice(1, end).join("\n");
  let metadata: Record<string, unknown> = {};
  try {
    const parsed = parse(yamlText);
    if (parsed && typeof parsed === "object") metadata = parsed as Record<string, unknown>;
  } catch (error) {
    console.warn(`[skill-loader] frontmatter YAML 解析失败：${(error as Error).message}`);
  }
  return { metadata, content: lines.slice(end + 1).join("\n").trimStart() };
}

function listDir(dir: string): string[] {
  try {
    return readdirSync(dir).sort();
  } catch {
    return [];
  }
}

function str(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

export class SkillLoader {
  constructor(private readonly dir: string) {}

  loadSync(): Skill[] {
    let entries;
    try {
      entries = readdirSync(this.dir, { withFileTypes: true });
    } catch {
      return [];
    }
    return entries
      .filter((entry) => entry.isDirectory())
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((entry) => this.loadSkill(entry.name));
  }

  private loadSkill(folder: string): Skill {
    const skillDir = path.join(this.dir, folder);
    const raw = readFileSync(path.join(skillDir, "SKILL.md"), "utf-8");
    const { metadata, content } = parseFrontmatter(raw);
    const name = folder;
    const metaName = str(metadata.name);
    if (metaName && metaName !== folder) {
      console.warn(`[skill-loader] ${folder}: frontmatter 的 name「${metaName}」与目录名不一致，以目录名为准`);
    }
    if (!SKILL_NAME_RE.test(folder) || folder.length > 64) {
      console.warn(`[skill-loader] ${folder}: 目录名不符合 kebab-case 规范（小写字母/数字/连字符，1-64 字符）`);
    }
    let description = str(metadata.description);
    if (description === undefined) {
      const heading = content.split("\n").find((line) => line.startsWith("# "))?.replace(/^#\s*/, "").trim();
      description = heading ?? "";
      if (description === "") {
        console.warn(`[skill-loader] ${folder}: 缺少 description（标准要求必填）`);
      }
    }
    return {
      name,
      description,
      content,
      dir: skillDir,
      scripts: listDir(path.join(skillDir, "scripts")),
      references: listDir(path.join(skillDir, "references")),
      assets: listDir(path.join(skillDir, "assets")),
    };
  }
}