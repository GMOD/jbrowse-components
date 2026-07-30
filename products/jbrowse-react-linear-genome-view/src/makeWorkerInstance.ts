// this is in a separate module here so it can be mocked out by jest. the
// import.meta.url is not well recognized by jest and we use MainThreadRpc in
// tests anyways right now
//
// a module worker rather than a classic one: standards-compliant, and under a
// native-ESM bundler (rolldown/vite) it lets the worker share chunks with the
// main-thread graph instead of duplicating them into a self-contained bundle.
// webpack's own chunk loading makes it byte-neutral there. it does mean the
// worker cannot importScripts, so PluginLoader falls back to dynamic import.
//
// the URL stays extensionless, unlike jbrowse-web/desktop: tsc does not rewrite
// `new URL()` string literals, so the one literal has to resolve both here
// (sibling rpcWorker.ts) and in the published package (esm/rpcWorker.js)
export default function makeWorkerInstance() {
  return new Worker(new URL('./rpcWorker', import.meta.url), {
    type: 'module',
  })
}
