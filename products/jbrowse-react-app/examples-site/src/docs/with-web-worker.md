By default the embedded app runs all data parsing and rendering on the main
thread, which can cause noticeable hitches on large alignments datasets (BAM,
CRAM). Switching to the WebWorker RPC moves that work off the main thread and
dramatically reduces UI stalls.

Pass a `makeWorkerInstance` factory to `createViewState` and select the
`WebWorkerRpcDriver` in config. In a Vite/Astro setup you construct the worker
from the package's `?worker` entry; in a webpack/CRA setup, import the package's
prebuilt `@jbrowse/react-app2/esm/makeWorkerInstance` instead:

```js
import RpcWorker from '@jbrowse/react-app2/esm/rpcWorker?worker'

const state = createViewState({
  config: {
    ...config,
    configuration: { rpc: { defaultDriver: 'WebWorkerRpcDriver' } },
  },
  makeWorkerInstance: () => new RpcWorker(),
})
```

### Bundler notes

- **Webpack** — set `output.publicPath: 'auto'` so the worker resolves its own
  URL (see the
  [Webpack web-workers guide](https://webpack.js.org/guides/web-workers/)).
- **Vite and other ESM bundlers** — the worker is constructed via
  `new Worker(new URL(...), { type: 'module' })`, which Vite handles natively.

The worker is off by default precisely because of these bundler requirements,
but we recommend enabling it whenever your toolchain supports it. If you also
load [plugins](../embedded-plugin/), they must be registered in **both** the
main thread and the worker. The `rpc` config block (driver, worker count,
timeouts) is documented in
[RpcOptions](https://jbrowse.org/jb2/docs/config/rpcoptions/).
