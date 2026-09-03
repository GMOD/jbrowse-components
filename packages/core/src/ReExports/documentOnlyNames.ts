// Names that an otherwise worker-safe ABI module serves only on the main
// thread, because the implementation needs `document`.
//
// `@jbrowse/core/util` is one module to a plugin and two jobs to the host: the
// bulk of it is data code the RPC worker runs, and `renderToStaticMarkup`
// mounts a real client root into a detached div. Keeping that one name out of
// `publicUtil.ts` is what keeps react-dom and @emotion off the worker's graph
// (sharedModules.purity.test.ts), and listing it here is what keeps it *served*:
// modules.ts adds the real function to the main thread's copy of the module and
// workerModules.ts fills the same key with `uiStub`, the way a whole UI module
// is filled. workerModules.test.ts pins both halves against this list.
//
// A worker never had a working `renderToStaticMarkup` -- before the split it
// was the real function and threw on `document.createElement` -- so the stub
// costs no realm anything it had.
export const DOCUMENT_ONLY_NAMES = {
  '@jbrowse/core/util': ['renderToStaticMarkup'],
}
