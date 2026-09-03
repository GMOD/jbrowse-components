// What a UI entry of the plugin ABI resolves to inside the RPC worker. Nothing
// in a worker renders, so a plugin bundle's module-scope reads and calls of one
// of these entries — destructuring a component, `styled(Box)(...)`,
// `observer(C)`, `createSvgIcon(...)` — only need to not throw; no code path
// ever reaches a difference. `then` is undefined so an await on it settles.
export const uiStub: unknown = new Proxy(function stubTarget() {}, {
  get: (_, key) =>
    key === 'then' ? undefined : key === Symbol.toPrimitive ? () => '' : uiStub,
  has: () => true,
  apply: () => uiStub,
  construct: () => uiStub as object,
})

// A namespace-shaped module (react-dom, @mui/material, the core ui barrel...)
// gets one real own property per real export name, each holding the stub. That
// makes it an ordinary object rather than a proxy that answers any key: exactly
// as readable as a plain object literal to `Object.keys`, `for...in`, a spread,
// or any bundler's module-interop helper, because it *is* one — with no need
// for this file to know what shape any particular bundler reads through.
export function uiNamespace(names: readonly string[]): Record<string, unknown> {
  return Object.fromEntries(names.map(name => [name, uiStub]))
}
