/** 一个能力的单个动作处理器：接收参数，返回结果。 */
export interface CapabilityHandler {
  (args: unknown): Promise<unknown>;
}

/** 一个完整的 Capability：名字 + 可选描述 + 多个命名动作。 */
export interface Capability {
  name: string;
  description?: string;
  actions: Record<string, CapabilityHandler>;
}

/** 运行时能力集的简易构建器，用于组装多个 Capability。 */
export interface CapabilitySet {
  readonly capabilities: Capability[];
  get(name: string): Capability | undefined;
  has(name: string): boolean;
}

export function createCapabilitySet(...capabilities: Capability[]): CapabilitySet {
  const map = new Map<string, Capability>();
  for (const cap of capabilities) map.set(cap.name, cap);
  return {
    capabilities,
    get(name: string) { return map.get(name); },
    has(name: string) { return map.has(name); },
  };
}