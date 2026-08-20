---
name: ancestral-recombination-graphs
description: Lorax's `--jbrowse` mode is a Python ARG server wearing JBrowse chrome — its adapter returns zero features and its deck.gl canvas is placed by the viewport rather than by the genome, so every pan re-slots the trees on the server. What a genome-anchored ARG display built on hpmath and instanced passes would change, why the decimation becomes a shader-side LOD instead of a round trip, and the tskit-reader question that decides whether the plugin needs a server at all.
---

# Ancestral recombination graphs

[Lorax](https://github.com/pratikkatte/lorax/) (Pratik Katte, UCSC) draws
ancestral recombination graphs as a strip of local trees along the genome, and
ships a `--jbrowse` mode that puts that strip inside a JBrowse linear genome
view. This is an analysis of what that mode is, and of what an ARG display built
on our GPU stack would do differently. Nothing here is committed work.

Read alongside [GPU_RENDERING.md](../reference/GPU_RENDERING.md) for the render
lifecycle the proposal leans on, and
[SYNTENY_LOD.md](../reference/SYNTENY_LOD.md) for the decimation pattern it
copies.

## What `--jbrowse` is

`lorax --file x.trees --jbrowse --assembly hg38` starts a FastAPI server that
serves a **prebuilt copy of JBrowse Web** out of the Python package
(`lorax_app/static/jbrowse`), plus a UMD plugin bundle beside it. The build
script pins the JBrowse Web tag to the `@jbrowse/core` version the plugin
compiled against — 4.2.1 today — by reading it out of the plugin's
`node_modules`. `--assembly` is mandatory in this mode and takes `hg19`/`hg38`
or a local `FASTA[,FAI[,GZI]]`; the server generates a `config.json` carrying
that assembly, an optional RefSeq/dbSNP track pair for hg19, and a
`defaultSession` that opens the Lorax track so nobody sees the landing page.

The plugin itself lives in a separate repo,
[pratikkatte/lorax-plugin](https://github.com/pratikkatte/lorax-plugin) (41
source files, 7,688 lines of TS/TSX), and registers the usual seven pluggable
elements: `LoraxTrack`, `LoraxDisplay`, `LoraxAdapter`, a guess-adapter, an
add-track workflow, RPC methods, and a metadata widget.

**The adapter is a facade.** `LoraxAdapter.getRefNames()` returns `[]` and
`getFeatures()` completes without emitting anything. It exists to satisfy the
track/adapter machinery and to hold one method JBrowse never calls,
`loadFile()`, which opens a socket.io connection to the Python backend and
emits `load_file`. Every byte the display draws arrives on that socket, not
through the adapter, so none of the block machinery, the RPC worker, the region
cache, or the feature-based hit testing is in play.

The display composes `BaseDisplay` and `TrackHeightMixin` and nothing else — no
`RenderLifecycleMixin`, no `MultiRegionDisplayMixin` — and strips `blockState`
in both `preProcessSnapshot` and `postProcessSnapshot`. Its React component
computes a "strict visible region" from `view.dynamicBlocks.contentBlocks`,
positions an absolutely-placed `<div>` at that region's left pixel, and mounts a
deck.gl canvas inside it. `import '@luma.gl/webgl'` at the top of the component
pins that canvas to WebGL2.

So `--jbrowse` is not an ARG track. It is the Lorax viewer, given a genomic
ruler, a reference sequence, and a track menu.

## What Lorax draws, precisely

The backend (`tree_graph.py`, 1,579 lines, numba-compiled) computes a post-order
layout per local tree: **x is normalized to [0,1] within the tree** (tips spread
evenly, an internal node at the midpoint of its children's extent) and **y is
node time**, linear or log. It emits columnar arrays over socket.io as pyarrow
bytes — `node_id`, `parent_id`, `is_tip`, `tree_idx`, `x`, `y`, `name`, plus a
parallel mutation set.

Placement along the genome happens in `sockets/intervals.py`, and this is the
part that matters:

- The **currently visible bp range** is cut into `slot_count` equal-width slots,
  where `slot_count = min(tree_count, max(10, ceil(tree_count / scale_factor)))`.
- Every local tree is assigned to the slot its midpoint falls in.
- **One representative tree per slot survives** — the largest-span tree by
  default, with `centerWeighted`, `spanWeightedRandom` and `first` as
  alternatives.
- The representative is drawn to fill `slot_width / 1.05`, centered on the slot,
  regardless of where its own recombination interval sits.

A `modelMatrix` per slot carries that scale and offset. A web worker
(`renderDataWorker.js`) turns the normalized coordinates into L-shaped
orthogonal edge paths in a `Float64Array`, **bakes the modelMatrix into the
vertex positions**, and hands binary buffers to a deck.gl `PathLayer` with
`fp64: true`. The worker caches the structure phase so an unchanged tree set
re-runs only the transform — but the transform still runs, and the buffers still
re-upload, on every viewport change.

Two consequences follow from placement being viewport-relative rather than
genome-anchored:

- **Panning re-slots.** Slot centers derive from the request's `start`/`end`, so
  a half-screen pan moves every drawn tree and can swap which tree represents a
  slot. The plugin's "Lock view" track-menu item exists to freeze this.
- **Decimation is a round trip.** The client sends its viewport bbox, and
  `_sparsify_edges_adaptive` / `_sparsify_mutations_adaptive` pick a cell size
  from it and drop nodes and mutations server-side before the response is built.
  Density control lives on the far end of a socket.

## Where our stack changes the cost structure

The interesting claim is not "WebGPU is faster". It is that three specific
pieces of machinery we already have remove the reasons Lorax's drawing is shaped
the way it is.

**hpmath removes the CPU transform.** `hpSplitUint` / `hpToClipX`
(`packages/render-core/src/shaders/hpmath.slang`) convert absolute genomic
uint32 to clip space in the vertex shader without float64, which is precisely
the problem `fp64: true` plus a CPU-baked modelMatrix is solving today. An edge
becomes an instance of `(intervalStart, intervalEnd, xNormParent, xNormChild,
yParent, yChild)` and the shader places it. Pan and zoom become a uniform
update. Nothing re-uploads, and there is no per-frame Float64 pass in a worker.

**That makes genome anchoring free, so the slot machinery can go.** Once a
tree's x is derived from its own recombination interval in the shader, a tree
sits where it belongs and stays there under pan. Slotting was never the goal —
it is what you do when placement is baked on the CPU and you want a fixed count
of buffers. Which trees to draw at a given zoom becomes an ordinary LOD
question, answered client-side.

**Decimation becomes a shader-side LOD off one upload.** Instead of asking the
server for a viewport-specific sparsified set, upload the region's edges once
and cull per frame — the pattern [SYNTENY_LOD.md](../reference/SYNTENY_LOD.md)
already documents for a different mark family. Pan costs nothing; the picture
stops depending on socket latency.

**On WebGPU, one device serves every display.** `gpuDevice.ts` hands every
backend the same `GPUDevice` and `deviceGpuCache.ts` memoizes pipelines against
it, so ten tracks of a type compile one pipeline set. A deck.gl canvas is
outside all of that: it takes its own WebGL2 context, and per
[GPU_CONTEXT_BUDGET.md](../reference/GPU_CONTEXT_BUDGET.md) a page gets 16 of
those before the eviction cascade wedges the main thread. An ARG track drawn on
our backend costs a context on WebGL2 (same as deck.gl) and **zero extra
contexts on WebGPU**.

**Everything else in the display chrome is already written.** `DisplayChrome`,
`displayPhase`, the loading scrim, `TrackHeightMixin`, the export path. The
plugin currently hand-rolls a loading overlay with an injected `<style>` block
and a `svgExportProvider` that walks deck.gl layers back into SVG
(`deckglToSvg.js`).

### What we would have to build

Honest accounting — the shader half is not free:

- **A general two-point line pass.** `plugins/canvas/.../line.slang` draws a
  1px *horizontal* line at a feature row's center; the vertical half of an
  L-shaped tree edge has no existing pass. A tree strip wants a segment pass
  taking two arbitrary endpoints and a pixel thickness.
- **A per-tree y scale.** Node time is per-ARG, not per-track-row, and log time
  is the common default. `wiggle-core`'s score scaling is the closest analogue
  and does not fit.
- **Hit testing.** Lorax picks with deck.gl's picking buffer. We would need the
  equivalent, and `SYNTENY_PICKING.md` is the precedent for how that has gone.
- **Tips, mutations, labels.** `pointGlyph.slang` covers tips and mutation
  marks. Labels are the usual problem.

## The data question decides whether a server is needed

A JBrowse-native ARG plugin only earns its keep if the adapter actually reads
something. A `.trees` file is a **kastore** container — a key/array store of
read-only numerical columns — whose keys mirror the tskit tables: `edges/left`,
`edges/right`, `edges/parent`, `edges/child`, `nodes/time`, `nodes/flags`,
`sites/position`, `mutations/site`, `mutations/node`, and the two arrays that
make sequential tree building possible,
`indexes/edge_insertion_order` and `indexes/edge_removal_order`. Those two are
the standard sweep: walk right along the genome, remove edges leaving scope,
insert edges entering it, and the tree at every recombination breakpoint falls
out incrementally.

There is no published JavaScript or wasm tskit binding I could find — the
official APIs are Python, C, Rust and R. So the adapter is either a kastore
reader written in TS (the format is small and the sweep is well specified), or
tskit's C compiled to wasm. **Neither is research, and the first is the kind of
thing this repo already does for a dozen formats.**

That last sentence is a judgement, not a measurement. The cheap way to settle it
is a spike: write the kastore reader, sweep the two index arrays, and diff the
local trees against `tskit`'s own output on the same file. Whoever picks this up
should do that first — the whole no-server half of the proposal rests on it, and
2026-08-19 could not, having no `.trees` file to hand and no room on the box to
install `tskit` and generate one.

The scale caveat is real and cuts the other way. Lorax's Python backend exists
because biobank-scale ARGs do not fit a browser, and its numba layout pass and
adaptive sparsification are load-bearing at that size. A client-side reader
serves simulated and moderate empirical ARGs; a server adapter stays the answer
for the large ones. That is the same split we already run for other formats, and
it argues for the adapter being a seam rather than a single implementation.

## What this would look like

A `plugins/arg` (or an external plugin, per
[RFC-001](../reference/RFC-001-community-plugin-api.md)) with:

- `TskitAdapter` — kastore reader plus the insertion/removal sweep, in the RPC
  worker, emitting **absolute genomic uint32** per the worker-output rule in
  `CLAUDE.md`. One "feature" per local tree, carrying its interval and its node
  arrays.
- `LinearArgDisplay` — `MultiRegionDisplayMixin` + a GPU backend with a segment
  pass for edges, `pointGlyph` for tips and mutations, hpmath for placement,
  client-side LOD for density.
- A Canvas2D twin and cross-backend goldens, per
  [CROSS_BACKEND_GATE.md](../reference/CROSS_BACKEND_GATE.md).

## What kills the obvious version

- **Rebuilding Lorax is not the idea.** Its metadata filtering, topology
  comparison, lineage tracing and node search are a viewer's worth of product
  (`LoraxMetadataWidget.tsx` alone is 1,652 lines) sitting on a Python backend.
  The proposal here is a *drawing* — the strip of local trees, genome-anchored —
  not a port.
- **Slot layout is not a bug to fix in their code.** It follows from CPU-baked
  placement, and telling them to change it without the shader-side placement
  underneath just makes their pan slower.
- **A tree strip may not want to be a track.** At the zoom where a local tree is
  legible it is taller than a track row wants to be, and at genome scale it is
  one pixel wide. The height question is the first thing to answer with a
  prototype, before any shader work — and it is the question that decides
  whether this is a display or a view.
