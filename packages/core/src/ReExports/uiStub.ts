// The RPC worker's stand-in for a UI entry of the plugin ABI; why, and why a
// namespace gets real own keys: agent-docs/reference/EAGER_BUNDLE.md.
export const uiStub: unknown = new Proxy(function stubTarget() {}, {
  get: (_, key) =>
    key === 'then' ? undefined : key === Symbol.toPrimitive ? () => '' : uiStub,
  has: () => true,
  apply: () => uiStub,
  construct: () => uiStub as object,
})

// `esModule` mirrors the `__esModule` the main thread sets on a namespace that
// carries a default export beside named ones, so a bundler's interop reads the
// stub's `default` the same way in both realms.
export function uiNamespace(
  names: readonly string[],
  esModule = false,
): Record<string, unknown> {
  return {
    ...(esModule ? { __esModule: true } : {}),
    ...Object.fromEntries(names.map(name => [name, uiStub])),
  }
}

// Own keys React puts on a component object, which are not export names and
// so do not survive into a stub or the manifest.
export const REACT_INTERNAL_KEYS = new Set([
  '$$typeof',
  '_debugInfo',
  '_init',
  '_payload',
  'compare',
  'contextTypes',
  'defaultProps',
  'displayName',
  'muiName',
  'propTypes',
  'render',
  'type',
])
