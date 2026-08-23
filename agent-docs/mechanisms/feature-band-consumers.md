---
name: feature-band-consumers
description: A panel showing what another panel already draws has two seams available — the other one's shell (model, config, fetch, lifecycle) or its pipeline (payload → layout → fit → paint → pick) — and only the pipeline composes. The nested-child-display attempt that proved it, the four cheapest answers now in tree, the purity precondition that decides whether the seam exists, and the seven rules a band consumer owes with the failure behind each. Read before adding a band to a display, before hosting one display inside another, and before packaging a band's pipeline for a second caller.
---

# A band consumes the pipeline, not the display

A panel routinely wants to show, in a strip of itself, what a different panel
already knows how to draw: a coverage histogram over a read pileup, the variants
over the genotypes that call them, a conservation summary over the alignment. The
composition has two seams available.

The **shell** is the other panel's model, its config node, its fetch and its
lifecycle. The **pipeline** is what it does with a payload once it has one —
layout, fit, paint, letter, pick. Both look like they compose. Only one does.

## The attempt that settles it

v4.3.0 composed at the shell: `LinearAlignmentsDisplay` held real nested child
displays as MST nodes. Every cost was a collision with an invariant rather than a
rough edge, and they are worth listing because each recurs on any second attempt:

- **Config could not reach a child.** Promotable slots resolve only at the top
  level, so child config was kept in step by five sync autoruns.
- **Child identity had to be fabricated** — `` `${displayId}_${lowerPanelType}_xyz` ``,
  the `_xyz` there to avoid colliding with a real one somebody might type. A
  comment in the tree apologized for it.
- **The session stopped being portable.** The child's state model was a union over
  whatever plugins were loaded, so a saved snapshot's shape depended on the
  deployment.
- **Height had three sources of truth** — the parent slot, the child height, and
  the autorun subtracting one from the other — and the menu was three levels deep.
- **Each child owned a fetch.** This is the deep one: a hosted display re-parses
  the same file the host already parsed.

It came out in two commits (`cfbdc6b0ec`, `0a9169a68f`, ~17k lines net), replaced
by one flat display. The residue is a `subDisplay` field on `DisplayType` that
nothing reads.

That last cost is what makes the shell seam unrecoverable rather than merely
expensive. A band's headline property is usually that it is a *render-tier*
setting — toggling it repaints and must not refetch. Under shell composition that
property is unreachable by construction, because the child's fetch is the child's.

## Four answers, cheapest per case

Nothing replaced the shell seam with one thing. Four mechanisms did, and the
choice between them is not a matter of taste:

| The band is | Answer | In tree |
| --- | --- | --- |
| another view of a payload the host already has | own bands, pure section math | `belowCoverageBandsGeometry`, `computeStackedSections` |
| the same band two hosts draw | package it — buffers, passes, layer order | `coverageBandBuffers` in `packages/render-core/src/coverageBand.ts` |
| another display's whole record rendering | consume that pipeline as functions | `buildLaneRenderData` → `paintFeatureBand` |
| the same display with different data | inherit the model | `LGVSyntenyDisplay` |

Row two and row three are the same idea at different maturities. A band with two
hosts belongs in a package; a band with one host borrows from the plugin that owns
the vocabulary, and moves when a second host appears.

## The precondition: everything after the payload is pure

The pipeline seam exists only where the producing display's chain is plain data
and plain functions — no MST, no React, no adapter, no fetch. Where it is, a
consumer supplies its own reactivity and its own height budget and gets everything
else: `buildFeatureRenderData`, `computeLaidOutData`, `resolveFitLadder`,
`paintFeatureBand`, `performMultiRegionHitDetection` are the same calls the
producing display makes.

Where it is not, the work is to purify the chain first — which is the same work as
making it unit-testable without booting a tree, so it is owed anyway.

## What a band consumer owes, and the failure behind each

Seven rules, each independently rediscovered by at least two plugins. This list is
the point of the doc: they are cheap to follow and expensive to derive.

- **Off spends 0 px, not a clamped minimum.** A band whose toggle leaves a floor
  behind moves every committed figure by that floor.
- **The reserver and the painter read one function.** A painter that thinks the
  band is taller than the layout reserved paints over the plot's first row, and
  nothing fails — it just looks like a rendering bug.
- **`showX` is not `xActive`.** The slots live on the display that can *paint* the
  band; a display that reserves one it cannot fill takes the height from its rows
  and leaves it blank.
- **A resize and a stated height are different reads.** `clampBandHeight` for a
  drag (a band dragged shut has to stay grabbable), `boundBandHeight` for a
  config, menu or slider value.
- **The probe and the commit pack through one builder.** A fit that measures one
  stack and commits another overflows the height it just fit, descends to the
  last rung, and every label vanishes — on the tallest bands only.
- **The pick reads the *rendered* label flags, not the requested ones.** Label
  overhang is part of the hit box, so a box that reserved room for a description
  the band had no room to draw claims pixels it never painted.
- **The export re-runs the composition; it does not restate it.** Two spellings of
  "paint then letter" produce an export the reader never saw.

The last two are why the composition, and not its pieces, is what gets shared:
`paintFeatureBand` takes the kept label flags and the band's own cull band, so a
consumer cannot letter at a font size the packer never measured. Exporting the
block painter and the label walk separately invites a second welding with its own
answer to both.

## Where it stops

- **No band registry.** At band granularity the precondition in
  [draw-pass-registries](draw-pass-registries.md) is cleared by exactly one
  display, and that one already has its list as `SectionRender`. A registry
  serving one member is
  [ADR-050](../architecture-decision-records/adr-050-track-containers-are-not-view-types.md)'s
  declined `trackContainer` group again.
- **Don't generalize the band allocators.** `computeBandStack` is five lines and
  `variantTopBandsGeometry` is twenty. Sticky coverage, scrolling sections and a
  fixed top band differ where they should; what they share is this doc, not code.
- **Don't package a consumer's fit chain until a second consumer exists.** The
  producing display's own chain is welded to its incremental layout memos and
  cannot consume the extraction, so a shared block would serve one caller.
- **No mixin at the display root.**
  [ADR-041](../architecture-decision-records/adr-041-no-mixin-composed-into-basedisplay.md)
  — shared policy at that level is a plain function, and a band's is a plain
  function over plain data by construction.

## The cost this is actually about

A band consumer is ~400 lines of executable glue. It has historically also been
~500 lines of prose re-deriving the seven rules above, because each was previously
findable only inside the plugin that learned it. Re-derivation is the cost, and a
named contract is the fix — not a framework, which would leave the rules exactly
where they were and add a registry on top.

Subsystem depth stays where it is:
[reference/MULTI_SAMPLE_VARIANTS.md](../reference/MULTI_SAMPLE_VARIANTS.md) for
the variant lane's payload, [reference/ARC_BAND.md](../reference/ARC_BAND.md) for
the alignments bands.
