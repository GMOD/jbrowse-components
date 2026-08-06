By default all parsing and rendering runs on the main thread, which hitches on
large alignments datasets. Passing `makeWorkerInstance` to `<JBrowse>` switches
RPC to the `WebWorkerRpcDriver`. Under Vite/Astro, construct the worker from the
package's `?worker` entry; under webpack/CRA, import the prebuilt
`@jbrowse/react-app2/esm/makeWorkerInstance` instead.

It is off by default only because of bundler requirements — enable it whenever
your toolchain allows:

- **webpack**: set `output.publicPath: 'auto'` so the worker resolves its own
  URL ([guide](https://webpack.js.org/guides/web-workers/)).
- **Vite and other ESM bundlers**: handled natively.

The worker is a separate JavaScript realm with its own plugin registry, so a
plugin contributing anything that runs there — an adapter, usually — must be
registered there too. It loads its own copy from the URL in the `definition`
each `loadPlugins` record carries, so **pass those records through as-is**:
`plugins.map(p => p.plugin)` throws the definition away and the plugin then
exists on the main thread only, where a track that needs it fails inside the
worker with an unknown-type error naming nothing about the cause.

One caveat: a **UMD** plugin loads in the worker via `importScripts`, which
module workers don't support. A Vite build with `worker.format: 'es'` (as this
site is) can't load UMD plugins worker-side; a classic worker can. The `rpc`
config block is [RpcOptions](https://jbrowse.org/jb2/docs/config/rpcoptions/).
