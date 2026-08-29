---
name: one-declaration-per-display-band
description: Every large display is a vertical stack of bands — alignments is coverage + pileup + arcs, MAF is coverage + conservation + rows — and each band's reserve/paint/pick are written separately and kept in agreement by prose. The proposal is to make the CONTRACT a type while the allocators stay per-display functions, so "the reserver and the painter read one function" is a build failure rather than a rule readers must remember. The only surviving level of the retired `defineDisplay` plan; the gauge deletes prose, not code, which makes it the highest-risk and smallest-code-win item in that family. Kill condition: if the type cannot be written without a registry, stop.
---

# One declaration per display band

Renamed 2026-08-29 from `a-display-declares-itself`, which was a name for the
whole multi-level plan around `defineDisplay` — a factory that no longer exists.
Five of that plan's six levels are closed;
[ADR-091](../architecture-decision-records/adr-091-a-displays-settings-are-a-declaration.md)
holds the history and
[DISPLAY_COMPLEXITY_CENSUS.md](../reference/DISPLAY_COMPLEXITY_CENSUS.md) holds
the measurement. This file is the one level that still stands, under a name that
says what it proposes.

## Today

**Every large display is already a stack of bands, and none of them says so.**

- Alignments = coverage + pileup + arcs (`sectionLayout.ts`,
  `belowCoverageBandsGeometry`, `computeStackedSections`)
- MAF = coverage + conservation + rows
- Multi-sample variant = variant lane + genotype matrix

That is the MAF↔alignments kinship exactly: **one shared band and one unshared
one.** The coverage half is already packaged (`render-core/coverageBand.ts` plus
`packages/alignments-core`, since `f2effb9167`). The rows half was this plan's
Level 2, retired 2026-08-28 — placement turned out to be five consumer-correct
conventions rather than one primitive waiting to be extracted, and the evidence
is in `f6b798b34a`. Nothing here depends on that retirement going the other way:
what Level 4 takes from the rows half is its *contract*, not an implementation.

## The move, and it is narrower than it looks

[feature-band-consumers](../mechanisms/feature-band-consumers.md) already
declined generalizing the band allocators, **correctly** — `computeBandStack` is
five lines, and sticky coverage and scrolling sections differ where they should.
**Do not overturn that.** What that doc has instead is seven rules, each
independently rediscovered by at least two plugins, and its own summary of the
cost: "~400 lines of executable glue and ~500 lines of prose re-deriving the
seven rules."

The move is to make **the contract** a type while the allocator stays a
function. A `Band` declares `reserve` / `paint` / `pick` / `active` off one
member, so two of the seven rules — "the reserver and the painter read one
function", and "off spends 0 px" — become build failures instead of prose.

## Gauge

A second band consumer costs the ~400 lines of glue and none of the ~500 lines
of prose.

**Note what that gauge deletes: prose, not code.** The glue stays by
construction, because the position is that the allocators should *not* be
generalized. So this is the highest-risk item in its family with the smallest
measured code win — the inverse of every other level in the plan it came from.
That is not an argument against it (re-derivation is a real cost, and a build
failure beats a rule readers must remember), but it argues for taking it last
and on evidence rather than on enthusiasm.

## Kill condition

**If the type cannot be written without a registry, stop.** A registry serving
one display is
[ADR-050](../architecture-decision-records/adr-050-track-containers-are-not-view-types.md)'s
declined `trackContainer` again. This is the level most likely to become a
framework, and that is the line.

## What this must not become

Each has been declined already, on grounds that still hold:

- **A band registry**, and **generalized band allocators** — see above.
- **A render graph, indirect draws, GPU-driven culling** —
  [GPU_RENDERING.md](../reference/GPU_RENDERING.md) §"What this architecture
  deliberately does not have", one specific reason each.
- **A transpiled draw stage** —
  [ADR-051](../architecture-decision-records/adr-051-shader-js-codegen-is-scalar-only.md)
  stands.
- **A mixin composed into `BaseDisplay`** —
  [ADR-041](../architecture-decision-records/adr-041-no-mixin-composed-into-basedisplay.md).
- **A glyph extension point inside `LinearBasicDisplay`** —
  [ADR-036](../architecture-decision-records/adr-036-delete-stranded-pluggable-glyph-registry.md).
