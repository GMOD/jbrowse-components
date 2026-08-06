By default all parsing and rendering runs on the main thread, which hitches on
large alignments datasets. A `makeWorkerInstance` factory moves it off. Under
Vite/ESM, construct the worker from the package's `?worker` entry; under
webpack/CRA, import the prebuilt
`@jbrowse/react-linear-genome-view2/esm/makeWorkerInstance` instead.

```js
import RpcWorker from '@jbrowse/react-linear-genome-view2/esm/rpcWorker?worker'

createViewState({ assembly, tracks, makeWorkerInstance: () => new RpcWorker() })
```

It is off by default only because of bundler requirements — enable it whenever
your toolchain allows:

- **webpack**: set `output.publicPath: 'auto'` so workers resolve their own URL
  ([guide](https://webpack.js.org/guides/web-workers/)).
- **Vite and other ESM bundlers**: handled natively.

The worker is a separate JavaScript realm with its own plugin registry, so a
[plugin](../plugins/#with-external-plugin) contributing anything that runs there
— an adapter, usually — must be registered there too. It loads its own copy from
the URL in the `definition` each `loadPlugins` record carries, which is why
those records are passed through unmapped.

One caveat: a **UMD** plugin loads in the worker via `importScripts`, which
module workers don't support. A Vite build with `worker.format: 'es'` therefore
can't load UMD plugins worker-side; a classic worker (what the prebuilt
`makeWorkerInstance` produces) can. ESM plugins are unaffected. The `rpc` config
block is [RpcOptions](https://jbrowse.org/jb2/docs/config/rpcoptions/).
