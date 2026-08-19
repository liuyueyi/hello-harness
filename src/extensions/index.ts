export type { Extension, ExtensionContext } from "./extension";
export { defineExtension } from "./extension";
export { ExtensionRegistry } from "./registry";
export type { InstalledExtension, ExtensionRegistryOptions } from "./registry";
export { PackageLoader } from "./loader";
export type { PackageManifest, ExtensionFactory, LoadedPackage } from "./loader";
export { createTraceHookExtension } from "./trace-hook";
export type { TraceHookOptions } from "./trace-hook";
