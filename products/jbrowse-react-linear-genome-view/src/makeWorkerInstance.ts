// Byte-identical to the sibling embedded products' copy, and deliberately not
// shared: the bundler resolves `./rpcWorker` relative to THIS file, and each
// product's rpcWorker registers that product's own corePlugins.
//
// `type: 'module'` is for Vite, whose ES worker chunks need it; webpack 5
// rewrites the type to match the worker it emits.
export default function makeWorkerInstance() {
  return new Worker(new URL('./rpcWorker', import.meta.url), { type: 'module' })
}
