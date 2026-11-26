---
name: the-synteny-ramp-key-is-opaque-over-faded-ribbons
description: A synteny key's ramp is drawn at full color while its ribbons are faded, so a ribbon cannot be matched to a value. Blending the ramp fixes the view but breaks parity with the R tables' key, so it waits on a ggjbrowse change.
---

# The synteny ramp key is opaque over faded ribbons

`colorByScales` (`packages/synteny-core/src/colorLegend.ts`) blends a
categorical key's chips over the band ground at the view's alpha
(`legendChipColor`), so a chip is the color its ribbons composite to. Its
`ramp` branch passes the stops through unblended. In
`synteny_color_legend_snapshot.svg` the ribbons are pale grey-blue at alpha
0.25 and the key's 100% end is saturated blue. The screen draws the same key,
so this is the key, not the export.

## What was tried

Sending the ramp stops through `legendChipColor`, with the same floor the
chips get. That is a few lines and reaches the dotplot and circular keys
through `SyntenyColorsMixin.legendAlpha`. It was reverted before landing,
because `packages/tables/src/parity/synteny.parity.test.ts` compares the
view's key to the key the tables export, and nine of its cases failed.

The tables export (`comparativeTables.ts`) ships a key's raw colors with a
`legendAlpha` beside them. The R side blends the chips with that alpha itself
and draws ramps as they come, so today both sides agree on an opaque ramp.

## What it waits on

ggjbrowse blending ramp stops the way it blends chips, or the tables shipping
blended ramp colors. Either is a change to what the R package draws, and the
two land together: the JBrowse change with the parity test, the ggjbrowse
change with a bundle rebuilt from it. Ramp stops already take an opacity
(ADR-108), which is the other way to carry it.
