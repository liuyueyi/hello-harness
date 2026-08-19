export type { Extension, ExtensionContext } from "./extension";
export { defineExtension } from "./extension";
export { ExtensionRegistry } from "./registry";
export type { InstalledExtension, ExtensionRegistryOptions } from "./registry";
export { PackageLoader } from "./loader";
export type { PackageManifest, ExtensionFactory, LoadedPackage, WorkspaceLike } from "./loader";
export { createTraceHookExtension } from "./trace-hook";
export type { TraceHookOptions } from "./trace-hook";

export { PromptLoader, PromptRegistry } from "./prompt/prompt";
export { SkillRegistry, MAX_SKILLS_LOADED } from "./skill/skill";
export type { Skill } from "./skill/skill";
export { SkillLoader, parseFrontmatter, SKILL_NAME_RE } from "./skill/loader";
export { renderSkillCatalog, injectSkillCatalog } from "./skill/inject";
