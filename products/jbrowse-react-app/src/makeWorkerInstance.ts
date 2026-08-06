// Byte-identical to the sibling embedded products' copy, and deliberately not
// shared: the bundler resolves `./rpcWorker` relative to THIS file, and each
// product's rpcWorker registers that product's own corePlugins. A shared module
// would hand every product product-core's worker, with the wrong plugin set.
// this is in a separate module here so it can be mocked out by jest. the
// import.meta.url is not well recognized by jest and we use MainThreadRpc in
// tests anyways right now
//
// note: this uses webpack 5 native worker modules
//
// see https://github.com/cmdcolin/cra-webpack5-web-worker-example for simple example
// and docs https://webpack.js.org/guides/web-workers/
export default function makeWorkerInstance() {
  return new Worker(new URL('./rpcWorker', import.meta.url))
}
