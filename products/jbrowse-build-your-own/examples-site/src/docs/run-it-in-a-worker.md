Reference-based CRAM decoding, record parsing and feature layout are real work,
and on the main thread every millisecond of it is a millisecond your UI is not
repainting. Supplying `makeWorkerInstance` moves all of it off: the RPC layer
switches its default driver, with no `defaultDriver` config to write. The demo
is the stack of tracks from earlier, and that one line is the only difference in
its source.

## Constructing the worker

`RpcWorker` is bundler-specific. This site is Astro, so it uses Vite's `?worker`
suffix, which bundles a module as a worker entry point and hands back a
constructor:

```ts
import RpcWorker from '@jbrowse/react-linear-genome-view2/esm/rpcWorker?worker'
```

On webpack or CRA, import the package's prebuilt
`@jbrowse/react-linear-genome-view2/esm/makeWorkerInstance` instead. Either way
JBrowse wants a function returning a `Worker`. The RPC worker code-splits, so
worker output has to be ES-format rather than the default IIFE
(`vite: { worker: { format: 'es' } }`, set in `astro.config.mjs`).

## What crosses the boundary

Fetching, parsing and layout run on the worker. Rendering does not. That is
WebGPU or WebGL on the main thread, and it needs the canvas. The worker is a
separate module graph with its own plugin manager, so anything adding an adapter
or a renderer has to be registered on both sides.
