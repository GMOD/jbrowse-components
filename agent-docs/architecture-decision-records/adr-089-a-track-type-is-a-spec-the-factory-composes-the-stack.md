---
status: Rejected
summary: "A third-party display is a spec of plain values and functions handed to defineDisplay, which composes the in-tree display stack once, inside display-kit; the author never composes a mixin, names a hook, or writes an RPC class, a config schema, a backend class or a component"
---

# ADR-089: A track type is a spec, and the factory composes the stack

## Status

Rejected (2026-08-24), and the code removed: [ADR-091](adr-091-a-displays-settings-are-a-declaration.md) has the measurements. The port of an in-tree display showed the spec holds a display's wiring and nothing else, so it was not kept for third parties either. What follows is the record as accepted; the file paths in it no longer exist.

As accepted: `packages/display-kit/src/defineDisplay.tsx`;
`plugins/linear-genome-view/src/displayKitTests/defineDisplay.test.ts` pins
the fetch, the settings split and the registration; `example-plugins/score-example`
is the gauge.

## Context

The published-ABI goal (`ideas/a-track-type-is-five-primitives`, since rejected with the factory it proposed: [ADR-091](adr-091-a-displays-settings-are-a-declaration.md))
needs an authoring surface a third party can hold. What existed was
`types.compose` over nine model layers, nineteen overridable hooks that default
silently, three MST view methods (`rpcProps`, `gpuProps`, `renderState`) whose
split is the commonest thing a new display gets wrong, an `RpcMethodType`
subclass plus a registry declaration merge per display, and a backend class,
a factory and a component per renderer. The docs already record why that
surface cannot shrink by consolidating mixins: ADR-041's inference ceiling,
the ordering rule a lint holds, and contract checks that never run out of
tree. The worked example took 17 files and 709 lines to draw a box per
feature.

## Decision

**A display is a spec.** `defineDisplay({ name, trackType, params, data,
paint, gpu? })`:

- `params` is the config slot table with one addition per slot, `affects:
  'fetch' | 'encode' | 'frame'`. The factory derives the RPC cache key from
  the `fetch` set and the render state from all of them. A fetch result cannot
  reach a cache key because a fetch result is not a param.
- `data(ctx)` runs in the worker. The factory registers the RPC method under
  `${name}Data`, with the adapter already resolved and the stop token and
  status callback on the context. No subclass, no declaration merge.
- `paint(ctx, regions, blocks, state)` is the Canvas2D painter and, unchanged,
  the SVG export.
- `gpu` is optional: the generated shader module, the passes packed from one
  region's payload, and the uniforms one clipped block draws with. The factory
  owns the renderer classes and the WebGPU → WebGL2 → Canvas2D factory.

**The factory composes the stack once.** Inside display-kit it builds the
config schema on `baseLinearDisplayConfigSchema`, composes `BaseDisplay`,
`TrackHeightMixin` and `MultiRegionDisplayMixin`, installs `installUpload`
over a `regionDataMap`, wires `DisplayChrome` and `renderDisplaySvg`, and
returns `{ configSchema, stateModel, ReactComponent, install }`. The typing
depth ADR-041 measured is paid once, for one fixed composition, not per
display at the author's call site.

**The in-tree stack is unchanged.** Every in-tree display keeps composing the
mixins directly; the factory is a consumer of them, not a replacement. It
covers the shape the example has, per-region data in a linear view, and says
nothing about alignments, the comparative views or the circular view.

## Consequences

- The gauge: the score-example is four files and 313 lines including its
  shader and its feature panel, of which the display is 16 + 196 lines with
  the GPU pass and its guide comments. It imports nothing from the linear
  genome view plugin.
- SVG export is free: a display that had none gained it by having `paint`.
- The settings split is a declaration checked by the test, not a convention
  in three method bodies.
- What the spec cannot say (a second fetch, a hover, a legend, a menu, a
  two-cell upload) is the in-tree stack's job until a second display needs
  it; the factory grows a field only on that pull.

## Rejected alternatives

**Thin the mixins further.** At the inference ceiling; every consolidation
proposal on record was declined on real grounds (ADR-041, ADR-054).

**A DSL that also derives the shader.** ADR-051 stands: a draw stage is not
transpiled. The `gpu` block is hand-written per shape; a mark library on top
of it is the next step, not this one.

**Type params from the slot's `type` name.** The default value's inferred
type is the value type, and it is what the author already wrote.
