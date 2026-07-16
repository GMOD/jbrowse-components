By default the embedded view runs all data parsing and rendering on the main
thread, which can cause noticeable hitches on large alignments datasets (BAM,
CRAM). Switching to the WebWorker RPC moves that work off the main thread and
dramatically reduces UI stalls.

Pass a `makeWorkerInstance` factory to `createViewState`. In a Vite/ESM setup
you can construct the worker from the package's `?worker` entry; in a
webpack/CRA setup, import the package's prebuilt
`@jbrowse/react-linear-genome-view2/esm/makeWorkerInstance` instead:

```js
import RpcWorker from '@jbrowse/react-linear-genome-view2/esm/rpcWorker?worker'

const state = createViewState({
  assembly,
  tracks,
  makeWorkerInstance: () => new RpcWorker(),
})
```

### Bundler notes

- **Webpack** — set `output.publicPath: 'auto'` so workers resolve their own URL
  correctly (see the
  [Webpack web-workers guide](https://webpack.js.org/guides/web-workers/)).
- **Vite and other ESM bundlers** — the worker is constructed via
  `new Worker(new URL(...), { type: 'module' })`, which Vite handles natively.

The worker is off by default precisely because of these bundler requirements,
but we recommend enabling it whenever your toolchain supports it. If you also
load [plugins](../plugins/#with-inline-plugins), they must be registered in **both** the
main thread and the worker.
