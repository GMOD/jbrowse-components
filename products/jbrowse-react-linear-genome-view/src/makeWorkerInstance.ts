// Byte-identical to the sibling embedded products' copy, and deliberately not
// shared: the bundler resolves `./rpcWorker` relative to THIS file, and each
// product's rpcWorker registers that product's own corePlugins. A shared module
// would hand every product product-core's worker, with the wrong plugin set.
//
// createModel imports this dynamically when the caller passes no factory, so
// the worker chunk stays out of the host's eager bundle; jest has no `Worker`
// and never reaches it.
//
// `type: 'module'` is for Vite, which builds the worker as ES chunks when they
// split and keeps the type it reads here. webpack 5 rewrites the type to match
// the worker it emits, so a webpack host still gets a classic worker, which is
// the kind that can load a UMD runtime plugin.
export default function makeWorkerInstance() {
  return new Worker(new URL('./rpcWorker', import.meta.url), { type: 'module' })
}
