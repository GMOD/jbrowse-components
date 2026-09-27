---
status: Accepted
summary: "A MultiWaySyntenyDisplay lane becomes a list of grammar layers drawn through its frame as a coordinate stage, the way ADR-119 draws the circle's rings, not a host of nested tracks. This reverses the collection's 'let a lane host tracks — leave it alone' call: that call priced a per-lane track container rebuilding the deleted MultiLGVSyntenyDisplay, and a layer list rebuilds none of it, since a lane keeps its one fetch lifecycle and gains marks rather than displays. Stage 1 is built: every lane prints its gene names under its glyphs, on by default behind `showGeneLabels`, decimated by the feature track's `keepFeatureLabel` and the mark display's overlap cull, which moved to display-ui as `cullOverlappingLabels`. Stage 2, gene glyphs and named-record placement boxes through `encodeFeatures`, waits on a measurement at 40 lanes against ADR-114's 3.11x"
---

# ADR-180: A multi-way lane is a layer list under its frame

## Status

Accepted (2026-09-26), on Colin's call to take the lanes onto the grammar so a
lane can print gene names and, later, carry extra rows. Reverses route (1) of
[ideas/collections/multiway-synteny-lgv-track.md](../ideas/collections/multiway-synteny-lgv-track.md)
§"More than one row per genome", and settles which lanes print gene names:
every lane, fit-or-drop.

## Context

A lane hand-packs its genes into `featureGlyphMarks` buffers in
`buildLaneCells`: rects, lines, arrows and a placement box where no gene covers
a group. It prints no names, so a reader of a 40-lane star names a gene only by
hovering it. It hosts one annotation, so a second row of data on a genome has
only the escape hatches: open that genome in its own LGV, or launch a
`LinearSyntenyView`.

The collection turned down letting a lane host tracks, because a per-lane
container of real displays is `MultiLGVSyntenyDisplay` again (~4,000 lines,
deleted in `884a126861`). That pricing is right for nested displays. It does not
apply to marks: the frame `{contig, flipped, rung, pivot}` is already an affine
map from a lane's bp to the stack's px, which is a coordinate stage in the
grammar's sense, and a layer drawn through it needs no view, layout or fetch
lifecycle of its own.

## Decision

- **A lane is a list of layers, each a source plus marks, drawn through the
  lane's frame.** The lane's genes are its first layer, their names its second;
  a later layer is any feature adapter with a `marks` spec, declared in config.
- **Names are on by default on every lane** (`showGeneLabels`, "Show gene
  labels" under Show). They sit in a row under the glyphs, which adds
  `geneLabelRowPx` to each lane's band and to the pitch floor.
- **They decimate as the feature track does.** A name stays only where its
  neighbours' edges leave room for it (`keepFeatureLabel`, factor 1), and of the
  rest, one meeting a kept name's halo goes (`cullOverlappingLabels`, the rule
  ADR-162's text mark already used, moved to display-ui). The label is
  the `text` slot, a field or jexl expression spelt as the mark display's
  `encoding.text`, and unset it is `getFeatureName`, the feature track's own
  name-else-ID. A placement box prints the name its table gives the gene.
- **Screen and export share one placement**, `laneGeneLabels`: DOM text through
  `FloatingText` on screen, `SvgHaloText` in the figure.

## Consequences

- Stage 2 moves the gene glyphs and the placement boxes onto `encodeFeatures`,
  gated on measuring the encoder at 40 lanes, since ADR-114 kept canvas's
  packer at 3.11x the encoder's cost. Only a named record draws a box already:
  an alignment record no gene covers names no gene to stand in for.
- Extra layers cost one fetch per lane each; the synced per-lane LGV (route 4)
  stays the drill-down for anything a mark list cannot say.
- The name row makes every lane taller by 12 px with names on, so a stack that
  was just above the pitch floor now scrolls.
