---
status: Rejected
summary: "A display declares a mark, a shape plus the channels that feed it, and the GPU pass, the Canvas2D painter and the SVG export derive from that one declaration; shapes live in render-core as one hand-written shader, one painter and one pack each, and the worked example needs no shader of its own"
---

# ADR-090: A mark is a shape plus its channels

## Status

Rejected (2026-08-24), and the code removed: [ADR-091](adr-091-a-displays-settings-are-a-declaration.md) has the measurements. The port of an in-tree display showed the spec holds a display's wiring and nothing else, so it was not kept for third parties either. What follows is the record as accepted; the file paths in it no longer exist.

As accepted: `packages/render-core/src/marks/bar.ts` and
`packages/render-core/src/shaders/bar.slang` are the first shape;
`packages/display-kit/src/marks.ts` is the mark-to-display wiring;
`example-plugins/score-example` draws with `mark: { type: 'bar', ... }`.

## Context

[ADR-089](adr-089-a-track-type-is-a-spec-the-factory-composes-the-stack.md)
left a third party writing a Canvas2D `paint` and, for the GPU, a `.slang`
shader plus a `gpu` block: a pass, a packer and a uniforms function. That is
three spellings of one drawing, and
[ideas/one-mark-declaration-per-feature](../ideas/one-mark-declaration-per-feature.md)
had already shown inside alignments that one declaration can drive the pack,
the paint and the hit test, LOC-neutral, and find a live GPU/Canvas2D
divergence on the way.

[ADR-040](adr-040-no-genome-quad-vertex-helper.md) declined a shared quad
shape on a two-consumer bar and said the third-party ergonomics argument would
be "a different justification". The published contract is that justification:
a shape in the library is the difference between a track type that needs a
shader toolchain and one that does not.

## Decision

**A mark is `{ type, ...channels }`.** In the grammar-of-graphics spelling,
`type` names the shape and the channels are accessors: `x`, `x2` and `y` read
parallel arrays off the region's payload, `color` reads the resolved params.
`defineDisplay` takes `mark` in place of `paint` + `gpu` and derives both.

**A shape is three things in render-core**, per
[ADR-051](adr-051-shader-js-codegen-is-scalar-only.md): one hand-written
`.slang` (never transpiled from anything), one Canvas2D painter over the same
channels (which is also the SVG export), and one packer from the channels to
the shader's instance layout. `bar` is the first: a box from `x` to `x2` in
absolute bp, `y` tall as a fraction of the canvas, one color per frame.

**`paint` + `gpu` stay public** as the altitude below marks, for a shape the
library does not have. A mark is built on exactly that altitude, so nothing a
mark can do is closed to a hand-written display.

## Consequences

- The gauge: the worked example is three files, 16 + 122 + 38 lines, no
  shader, no draw function, and still draws on WebGPU, WebGL2, Canvas2D and
  into SVG.
- One shape, and the bar to add the next one is a display that needs it:
  `point` (Manhattan's disc, whose SDF already lives in `pointGlyph.slang`),
  `span`, `line`, `arc`, `tile`. A shape module is admitted by a consumer,
  not by completeness.
- `color` is a uniform per frame, not a lane per instance. A per-instance
  color channel is the first extension a real consumer will ask for, and it
  changes the instance layout, so it is a second shape variant rather than an
  option on this one.
- Hit testing does not derive yet. The channels are what a hit test needs
  (`x`..`x2` contains bp, `y` above the cursor), so it is the next thing a
  mark should give for free.

## Rejected alternatives

**Derive the shader from the channels.** ADR-051 stands; a draw stage is
hand-written per shape, which is once per shape rather than once per display.

**Put the mark-to-display wiring in render-core.** Resolving a CSS color to a
packed ABGR needs `@jbrowse/core`, which render-core does not depend on; the
shape (render-core) takes a packed number, the mark (display-kit) resolves it.
