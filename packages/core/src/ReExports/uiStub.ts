// What a UI entry of the plugin ABI resolves to inside the RPC worker. A plugin
// bundle is one file for both realms, and at module scope it reads and calls
// these entries — destructures components, `styled(Box)(...)`, `observer(C)`,
// `createSvgIcon(...)` — so every key must exist and every read and call must
// succeed. Nothing in a worker renders, so no code path ever reaches a
// difference. `then` is undefined so an await on it settles.
function stubTarget() {}

export const uiStub: unknown = new Proxy(stubTarget, {
  get: (_, key) =>
    key === 'then' ? undefined : key === Symbol.toPrimitive ? () => '' : uiStub,
  has: () => true,
  apply: () => uiStub,
  construct: () => uiStub as object,
})
