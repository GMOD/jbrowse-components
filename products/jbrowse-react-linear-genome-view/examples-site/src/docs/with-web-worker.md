By default the embedded view runs all data parsing and rendering on the main
thread, which can cause noticeable hitches on large alignments datasets (BAM,
CRAM). Switching to the WebWorker RPC moves that work off the main thread and
reduces UI stalls.

Pass a `makeWorkerInstance` factory to `createViewState`. In a Vite/ESM setup
you can construct the worker from the package's `?worker` entry. In a
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

- **Webpack**: set `output.publicPath: 'auto'` so workers resolve their own URL
  correctly (see the
  [Webpack web-workers guide](https://webpack.js.org/guides/web-workers/)).
- **Vite and other ESM bundlers**: the worker is constructed via
  `new Worker(new URL(...), { type: 'module' })`, which Vite handles natively.

The worker is off by default because of these bundler requirements, but we
recommend enabling it whenever your toolchain supports it. The `rpc` config
block (driver, worker count, timeouts) is documented in
[RpcOptions](https://jbrowse.org/jb2/docs/config/rpcoptions/).

### Plugins and the worker

The worker is a separate JavaScript realm with its own plugin registry, so a
[plugin](../plugins/#with-external-plugin) contributing anything that runs there
— an adapter, most often — has to be registered there too. It loads its own copy
from the plugin's URL, which it learns from the `definition` carried on each
record `loadPlugins` returns. That is why those records are passed through
unchanged rather than mapped down to `p.plugin`.

One bundler caveat: a **UMD** plugin is loaded in the worker via
`importScripts`, which module workers don't support. A Vite build configured
with `worker.format: 'es'` therefore can't load UMD plugins worker-side, while a
classic worker — what the package's prebuilt `makeWorkerInstance` produces under
webpack — can. Plugins published as ESM have no such restriction.
