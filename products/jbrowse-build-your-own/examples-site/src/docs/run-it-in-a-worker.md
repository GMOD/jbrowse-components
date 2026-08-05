Every other page on this site runs the engine on the main thread. That is one
fewer moving piece in a demo and the wrong choice in an app: BGZF inflation, BAM
record parsing and feature layout are real work, and on the main thread every
millisecond of it is a millisecond your own UI is not repainting.

Moving all of it off is one option:

```ts
createViewState({
  assembly,
  tracks,
  makeWorkerInstance: () => new RpcWorker(),
})
```

Supplying `makeWorkerInstance` is the whole change. The RPC layer sees it and
switches its default driver to the web-worker one — there is no `defaultDriver`
config to write — and nothing else on the page moves. The demo below is the
stack of tracks from earlier with the plain overlays installed, and the only
difference in its source is that one line.

## Constructing the worker

`RpcWorker` above is bundler-specific, and it is the part that trips people up.
This site is an Astro app, so it is Vite's `?worker` suffix, which bundles a
module as a worker entry point and gives back a constructor:

```ts
import RpcWorker from '@jbrowse/react-linear-genome-view2/esm/rpcWorker?worker'
```

On webpack or CRA, import the package's prebuilt worker
(`@jbrowse/react-linear-genome-view2/esm/makeWorkerInstance`) and pass it
straight through instead. Either way what JBrowse wants is a function returning
a `Worker`; how you get one is your bundler's business.

One Vite setting goes with it: the RPC worker code-splits, so the worker output
has to be ES-format rather than the default IIFE
(`vite: { worker: { format: 'es' } }`). This site sets it in `astro.config.mjs`.

## What crosses the boundary

Fetching, parsing and layout run on the worker. Rendering does not — that is
WebGPU or WebGL on the main thread, and it needs the canvas. What comes back is
data in a form the boundary can carry cheaply, which is what stops the move
trading parse time for postMessage time.

The consequence to plan for is plugins. The worker is a separate module graph
with its own plugin manager, so anything that adds an adapter or a renderer has
to be registered on both sides — it is not enough to have passed it to
`createViewState`.

## Is it worth it for one small track?

For a single BigWig at low resolution, honestly, no — the setup costs more than
the parsing does. The BAM in the demo is the case that justifies it: a pileup
re-parses records on every pan, and that is exactly the work you do not want
sharing a thread with your app's own interactions.
