---
name: pending-calls
description: The three calls after the arc band geometry round, all answered by Colin on 2026-09-25 and none of them built yet. A colour range on a baked field is honoured through the domain/range scale every other display uses; the band's port onto the link mark is ADR-170; and landing regenerates. Read before starting any of the three.
---

Three decisions, answered 2026-09-25. Each premise below was verified against
the code — read the pointer rather than re-deriving it. **Delete this file once
the three are built.**

## 1. A custom colour on strand / pair orientation is accepted and dropped

`isBakedScheme` (`plugins/alignments/src/shared/alignmentsColor.ts:192`) admits
only `mateRefName` and `tag`/`attribute`, and it is the gate
`bakedColorScale.ts:160` reads a declared `range` behind. So
`color: { field: 'pairOrientation', range: … }` validates, saves, and changes
nothing. `swatchPaletteKeys` is the other half: it collapses `pairLR`,
`normalInsert`, `nonSplit`, `noTagValue` and `mapqUnavailable` onto one
`colorPairLR`, so `model.ts:1173` writes `colorSetting.value` over all five and
the arc baseline with them — one swatch, five meanings.

**Answered: colour one level on its own**, and in the spelling every other
display already uses rather than a new one:

```
color: { field: 'pairOrientation', domain: ['RR'], range: ['#d95f02'] }
```

`categoricalScale` (`packages/core/src/ui/colors.ts:203`) already resolves that:
a declared `range` covers the `domain` positionally, and a value outside the
domain takes an unused slot from the `fallback` palette. It is ggplot2's
`scale_colour_manual(breaks=, values=)` and Vega-Lite's `scale: {domain, range}`.

Two things follow, and they are the whole fix:

- **A baked scheme is a default range, not a reason to ignore a declared one.**
  `isBakedScheme` becomes the `fallback` argument `categoricalScale` already
  takes, so the alignments palette is what an unnamed level falls through to.
- **`swatchPaletteKeys` collapsing five levels onto one slot is a domain
  problem.** The scale claims five levels and holds one. A default range may
  repeat a colour; a domain may not collapse. Five entries, the same default
  colour, each one overridable.

The layer this lands as is unchanged from the original reading: a
`ReadColorCategory → RGBColor` resolution between the theme palette and its
three readers — `pileupUniforms.ts:137-141` (via `READ_CATEGORY_UBO_SLOTS`,
`:73`), `categorySwatchColor` (`colorUtils.ts:556`) and `palettes.ts`'s
`resolve`. It reaches the arcs with their nine slots intact, so it needs no
palette merge; the merge itself is declined at `palettes.ts` and that note
stands.

## 2. The arc band onto the link mark

**Answered: do it, whole band, straight replacement.**
[ADR-170](../architecture-decision-records/adr-170-the-read-connections-band-is-a-marks-list.md)
carries the design and Colin's two picture calls inside it — the read cloud's
connector takes its category colour, and the breakend feet stay on
interchromosomal arcs.

The short version: `arcMarks.ts` already defines the band through `defineMark`,
so the four shapes are private rather than absent. `arc` is `link` under
`linkShape: 'dome'`, `arcFlat` is the `line` shape GenomeSpy carries and
ADR-163 skipped, `arcMarker` is a `point` glyph, and `arcLine` is the link's
own stem. Lifting the view-scope region table out of the mark display's
`linkRegions` getter into `display-kit` is what lets every one of them cross a
seam, and it is what retires `CrossRegionArcsOverlay`, `CrossRegionArcsSvg` and
`crossRegionOverlay.ts` outright.

Two of the geometry round's four fixes are already in shared render-core
(`wideCircleLeg`, `curveDistance`) and the link mark draws through them. The
other two are band-specific and retire with it.

## 3. Landing regenerates

Measured 2026-09-25: **26 of the last 200 commits are standalone
`pnpm autogen`**, all from that one day. Main sat red on stale generated
artifacts for most of the round, and the pre-commit hook says outright that the
commit it names is "where it was last re-checked, NOT what broke it", so every
agent that commits meanwhile pays the attribution cost before it can tell
whether the staleness is its own.

**Answered: yes, on the land path.** A branch fast-forwards into main once, so
it is one run per branch. Not the pre-commit hook: that measured ~60 s wall
clock, and several generators compile the live tree.

`.githooks/post-merge` is the seam.

## Not a call, and not fixable

`540312de13` carries shader output emitted from an older tree — a rebase
conflict in `*.generated.ts` resolved by taking a side instead of regenerating,
which is the case `CLAUDE.md` names. `855427e5fd` fixed it forward 96 s later
and main regenerates clean today, so only a bisect landing exactly on that
commit builds off stale shaders.
