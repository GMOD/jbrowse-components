BGZF inflation, BAM record parsing and feature layout are real work, and on the
main thread every millisecond of it is a millisecond your UI is not repainting.
Supplying `makeWorkerInstance` moves all of it off — the RPC layer switches its
default driver, with no `defaultDriver` config to write. The demo is the stack
of tracks from earlier with plain overlays, and that one line is the only
difference in its source.

## Constructing the worker

`RpcWorker` is bundler-specific, and that is the part that trips people up. This
site is Astro, so it uses Vite's `?worker` suffix, which bundles a module as a
worker entry point and hands back a constructor:

```ts
import RpcWorker from '@jbrowse/react-linear-genome-view2/esm/rpcWorker?worker'
```

On webpack or CRA, import the package's prebuilt
`@jbrowse/react-linear-genome-view2/esm/makeWorkerInstance` instead. Either way
JBrowse wants a function returning a `Worker`.

One Vite setting goes with it: the RPC worker code-splits, so worker output has
to be ES-format rather than the default IIFE
(`vite: { worker: { format: 'es' } }`, set here in `astro.config.mjs`).

## What crosses the boundary

Fetching, parsing and layout run on the worker. Rendering does not — that is
WebGPU or WebGL on the main thread and it needs the canvas. What comes back is
data in a form the boundary carries cheaply, so the move doesn't trade parse
time for postMessage time.

Plugins are the consequence to plan for: the worker is a separate module graph
with its own plugin manager, so anything adding an adapter or a renderer has to
be registered on both sides.
