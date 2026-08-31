---
title: Data flow, end to end
description:
  The whole path from a viewport change to pixels in one figure, and where the
  worker, the wasm, the caches and the GPU sit on it
guide_category: Core concepts
---

**TL;DR:** A track's data crosses one boundary and lands in typed arrays of
absolute genomic coordinates, and everything after that point is a redraw. A pan
or a zoom therefore costs a frame and not a fetch.

<Figure caption="A pan or a zoom takes the dashed edge down the right: it re-enters at buffers the GPU already holds, and nothing above that point runs again. The three crossings carry the name of the figure that draws them in full." src="/img/dataflow.png" />

A viewport change asks one question first: is this region already loaded? Where
it is, nothing below the top of the figure runs. Where it is not, the display
calls an adapter in an RPC worker, which reads the file's index, issues range
requests for the chunks the index named, inflates them, builds records, and
reduces those records to what the screen needs — a layout, a coverage summary, a
set of packed columns. The result crosses back as transferable typed arrays in
absolute genomic coordinates, and the main thread uploads it once.

Three other pages draw one segment of this path in full, and the figure names
each one on the edge it details:

- [Data fetching](/docs/developer_guides/data_fetching) owns the decision the
  top edge carries (`fetch_chain`), with its debounce, byte gate, staleness
  check and generation counter
- [RPC workers](/docs/developer_guides/rpc_workers) owns the crossing
  (`rpc_lifecycle`), with the serialize and deserialize hooks on it
- [Creating a GPU display](/docs/developer_guides/creating_gpu_display) owns the
  two autoruns at the bottom (`gpu_display_lifecycle`)

Why each step looks the way it does, and what measured it, is
[](/docs/developer_guides/optimizations).

The figure is the main path only. It leaves out:

- the assembly and refName aliases, which load before any track does
- the text-search index, which answers the location box
- the non-linear views — synteny and dotplot own their fetch and share one
  canvas between displays, so they compose neither of the
  [fetch foundations](/docs/developer_guides/creating_display#display-foundations)
  this path is built on

[SHARED_CANVAS_VIEWS.md](https://github.com/GMOD/jbrowse-components/blob/main/agent-docs/reference/SHARED_CANVAS_VIEWS.md)
draws that third shape, and its rules generalize to any container laying out one
canvas its children draw on.

## Where the worker sits

Everything inside the box runs off the UI thread, in a pool that leaves one core
for the UI and is capped at five —
[`workerCount`](/docs/config/rpcoptions#slot-workercount) overrides that. A
track's queries are **sticky** to one worker, so a second query from the same
track queues behind the first. That stickiness is what makes the inflate pool
inside the worker worth having, and it is also a ceiling: one track's parse is
single-threaded however many cores the machine has.

The main thread holds the result, uploads it, and draws it.

**Which hosts spawn that pool is the host's decision.** jbrowse-web and desktop
always do. An embedded component runs the same pool once the page hands it a
`makeWorkerInstance` factory; without one it runs every step in the box on the
UI thread, so a deep BAM stalls whatever else the page is drawing. Constructing
a worker is bundler-specific, so the factory is the host's to write — the
[web worker example](https://jbrowse.org/storybook/lgv/plugins#with-web-worker)
has the Vite and the webpack spelling, and passing one is the whole switch, with
no config slot to set.

## Where wasm sits

Everything orange is BGZF decompression, in
[`@gmod/bgzf-filehandle`](https://github.com/GMOD/bgzf-filehandle). It is wasm
because that is where a cold query's time goes: most of the wall clock inflating
blocks, against a fraction of a millisecond to a few milliseconds building
records out of them. Reading the index and decoding records both stay in
JavaScript.

The dashed branch beside the inflate step is a further pool of
[four workers](https://github.com/GMOD/bgzf-filehandle/blob/main/docs/worker-pool.md#four-workers-is-not-the-ceiling),
one pool per JS context — so a full RPC pool nests twenty inflate workers under
its five. Where nested workers are unavailable the pool resolves to `undefined`
and the same code inflates in process, so the option is safe to pass
unconditionally and the degradation carries no error. How large that share is,
what the pool is worth per format, and how to check it engaged are
[the fetch clock](/docs/developer_guides/optimizations#decompression-is-where-a-cold-querys-time-goes).

## Where the caches sit

Three layers cache different things, and they compose because each dedups a
different unit:

| layer                        | unit                                | lives in          | goes stale when    |
| ---------------------------- | ----------------------------------- | ----------------- | ------------------ |
| `RemoteFileWithRangeCache`   | compressed bytes, in aligned blocks | the worker        | never              |
| the parser's own chunk cache | decompressed and parsed chunks      | the worker        | never              |
| `rpcDataMap`                 | one region's finished columns       | the display model | `rpcProps` changes |

Only the last is on the figure, because it is the one a gesture interacts with.
A pan back over a region the display still holds does no work at all; a pan onto
a new region re-enters at the top.

The two lower layers hold a byte range and what that range decoded to, and
neither answer changes while the session runs — they are evicted, never
invalidated, and what evicts them is [](/docs/developer_guides/memory).
`rpcDataMap` is the one that can hold a wrong answer: it keeps what the worker
computed under one set of settings, so `SettingsInvalidate` watches the
serialized `rpcProps()` and clears the map when that string changes.
[The cache key](/docs/developer_guides/data_fetching#rpcprops-the-cache-key)
says what may go in it.

## Where the GPU sits

The two edges out of `rpcDataMap` run at different rates. Data crosses to the
GPU when the region changes. Frames after that redraw buffers that are already
there, and all a frame writes is a shader parameter — a pan, a zoom, a recolor,
a re-sort, a resize.

A display with no working GPU backend takes the dashed branch and draws the same
data with a Canvas2D function. [](/docs/developer_guides/svg_export) runs that
same function against a context that serializes each call, which is what stops
on-screen and exported pixels drifting apart. Every canvas-drawing display
supplies one, and the shader path is the optional accelerator on top.

## Where the parsers sit

`read the index`, `read the chunks it named`, `inflate` and `build records` are
one library per format, maintained in their own repositories, and the three big
ones each draw this segment with the same legend:

- [`@gmod/bam`](https://github.com/GMOD/bam-js/blob/main/docs/dataflow.md) — BAM
- [`@gmod/tabix`](https://github.com/GMOD/tabix-js/blob/main/docs/dataflow.md) —
  VCF, GFF, BED and everything else bgzipped and tabix-indexed
- [`@gmod/cram`](https://github.com/GMOD/cram-js/blob/main/docs/dataflow.md) —
  CRAM, whose unit is a slice

What JBrowse adds on top of them is the rest of this figure: the decision not to
fetch, the reduction to columns, and the boundary they cross.
