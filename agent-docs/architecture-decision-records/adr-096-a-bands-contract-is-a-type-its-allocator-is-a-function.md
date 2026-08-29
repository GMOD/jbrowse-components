---
status: Accepted
summary: "A display's vertical band stack is declared as data — Band {active, height, bounds?} folded by stackBands into tops and a bottom (core/util/bandLayout.ts) — while the allocators stay per-display functions. Two of feature-band-consumers' seven prose rules became structural: 'off spends 0 px' has one spelling (reservedPx), and the reserver and the painter read one fold. The paint/pick payloads carry reserved heights, never a flag beside a raw height. Closes the retired defineDisplay plan's last level; no band registry, no generalized allocators"
---

# ADR-096: A band's contract is a type; its allocator is a function

## Status

Accepted (2026-08-29). Closes the last open level of the retired `defineDisplay`
plan ([ADR-091](adr-091-a-displays-settings-are-a-declaration.md) holds that
history). The contract is `packages/core/src/util/bandLayout.ts`;
[mechanisms/feature-band-consumers](../mechanisms/feature-band-consumers.md)
stays the operating doc for band consumers and their seven rules.

## Context

Every large display is a vertical stack of bands — alignments is coverage +
arcs + sashimi + pileup, MAF is coverage + conservation + rows, multi-sample
variants is a variant lane + connector zone + genotype rows — and each band's
reserve, paint and pick were kept in agreement by prose. The measured cost, per
`feature-band-consumers`: a band consumer is ~400 lines of glue and has
historically been ~500 lines of prose re-deriving seven rules, each learned
independently by at least two plugins.

The drift was live, not hypothetical, when this landed:

- MAF stated "conservation begins where coverage ends" three times (the model's
  band labels, the band component's `top`, the SVG export's translate), pinned
  by nothing.
- "Off" had four spellings in one plugin: a height pre-zeroed before the stack
  (`// already gated to 0 when coverage is hidden`), a flag beside an implicit
  height, an `undefined` object, and a `> 0` test.
- Alignments shipped `showCoverage` next to the raw `coverageHeight` slot in
  its render state and hit-test options, and five consumers re-derived the gate.
- The same getter name meant two things two plugins apart:
  `coverageDisplayHeight` is the coverage band's reserved height in MAF and the
  whole reserved stack above the pileup in alignments — a hazard that produced
  a real bug during this very conversion (the coverage hit test claimed the
  down-mode arc strip) and was caught by `arcGestureGuard.test.ts`.

## Decision

**The contract is a type and a ten-line fold; the allocators stay per-display
functions.**

`@jbrowse/core/util/bandLayout` declares:

- `Band` — `active` (the display pre-ANDs its settings half with its data
  half), `height` (the stated height), optional `bounds` (present ⇒
  `boundBandHeight` applies at read time).
- `reservedPx(band)` — the single spelling of "off spends 0 px".
- `stackBands(order, bands)` — the fold: one ordered declaration per display,
  yielding `top` per band, `reserved` per band, and `bottom`.

Each display states its stack once and everything reads the fold:

- **MAF**: `topBands` over `['coverage', 'conservation']`; the three spellings
  of conservation's top now read `top.conservation`, and `topBands.test.ts`
  pins the order and off-spends-0px (removing the `active` gate goes red).
- **Variants**: `variantTopBandsGeometry` builds on the fold; the lane carries
  `VARIANT_LANE_BOUNDS` as its `bounds`, the connector zone stays toggle-less
  (off is the slot being 0). Its existing suite passed unchanged.
- **Alignments**: `BAND_ORDER` states coverage → arcs → sashimi once;
  `belowCoverageBandsGeometry` and `computeStackedSections` each fold it, the
  five-line `computeBandStack` and its pre-gated input type are deleted, and
  the paint/pick payloads (`RenderState`, `HitTestOptions`) carry the reserved
  coverage height with no flag beside it.

## What "a build failure instead of prose" honestly means

The retired plan's phrasing was that two of the seven rules become build
failures. What landed is slightly different and worth stating exactly:

- **"The reserver and the painter read one function"** is structural: the fold
  is the only derivation of tops and bottoms, and the payload types carry its
  outputs.
- **"Off spends 0 px"** is one spelling (`reservedPx`) plus a sabotage-checked
  test per display, not a compile error — a bare type cannot fail a build on a
  value property. What the type does instead is make the wrong state
  unrepresentable downstream: the paint and pick payloads no longer contain a
  raw-height + flag pair for a consumer to re-gate wrongly.

## What this is not

Each of these was declined before, on grounds this ADR does not disturb:

- **Not generalized allocators.** Sticky coverage, scrolling sections, a fixed
  top band, per-lane iteration, and reserved≠drawn for up-mode arcs
  (`computeArcBand`) differ where they should. Only the fold is shared.
- **Not a band registry** —
  [ADR-050](adr-050-track-containers-are-not-view-types.md)'s declined
  `trackContainer` again; the kill condition this work carried ("if the type
  cannot be written without a registry, stop") stayed clear.
- **Not a mixin in `BaseDisplay`** —
  [ADR-041](adr-041-no-mixin-composed-into-basedisplay.md).
- **Not the shell seam.** A band consumes a pipeline, never a hosted display —
  `feature-band-consumers` owns that boundary and the other five rules, which
  remain prose there.

## Consequences

- A new band, or a new band consumer, declares a `Band` and joins a fold; the
  ~500 lines of re-derived prose shrink by the two rules the fold enforces, and
  the other five stay `feature-band-consumers`' to teach.
- `@jbrowse/core/util/bandLayout` is permanent plugin-ABI surface
  (`reference/PLUGIN_ABI_STABILITY.md`), kept deliberately minimal: one
  interface, two functions. A mode flag or a scheme registry growing on it is
  the failure to refuse.
- Alignments' `coverageDisplayHeight` keeps its historical meaning (the stack
  bottom) and its cross-plugin name collision with MAF's; renaming it is a
  separate decision this ADR only flags.
- With this level closed, every level of the `defineDisplay` plan is settled:
  rejected with measurements (ADR-089/090/091), retired on a re-census
  (placement), or landed in the narrow form this ADR records.
