---
name: pending-calls
description: The calls after the arc band geometry round, answered by Colin on 2026-09-25. A colour range on a baked field is honoured through the domain/range scale every other display uses, and landing regenerates; neither is built. The third, the band's port onto the link mark, is built (ADR-170). Read before starting either.
---

Decisions answered 2026-09-25. Each premise below was verified against the code
— read the pointer rather than re-deriving it. The band's port onto the link
mark is built (ADR-170). **Delete this file once the other two are built.**

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
`resolve`. It reaches the band through `buildArcBandFeeds`, which bakes each
connection's colour from `buildArcColorPalette`, so it needs no palette merge.

## 2. Landing regenerates

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
