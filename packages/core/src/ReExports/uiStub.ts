// The RPC worker's stand-in for a UI entry of the plugin ABI; why, and why a
// namespace gets real own keys: agent-docs/reference/EAGER_BUNDLE.md.
export const uiStub: unknown = new Proxy(function stubTarget() {}, {
  get: (_, key) =>
    key === 'then' ? undefined : key === Symbol.toPrimitive ? () => '' : uiStub,
  has: () => true,
  apply: () => uiStub,
  construct: () => uiStub as object,
})

export function uiNamespace(names: readonly string[]): Record<string, unknown> {
  return Object.fromEntries(names.map(name => [name, uiStub]))
}
