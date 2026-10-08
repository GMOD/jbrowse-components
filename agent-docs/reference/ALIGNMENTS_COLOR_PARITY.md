---
name: alignments-color-parity
description: How are a pileup's three color vocabularies (read fills, arc overlays, linked-read connectors) kept in agreement? Read before touching arc color or the alignments legend.
audience: internal
kind: spec
---

# Alignments color parity

A pileup draws one meaning through three vocabularies that share the screen and
one legend box: read fills (`readColorCategory`, `colorUtils.ts`), arc overlays
(`getArcColorType`, `features/arcs/arcColors.ts`) and linked-read connectors
(`LINKED_READ_COLOR_*`, `features/linkedReads/compute.ts`).

## The rule: derive, do not reconcile

Each overlay has **one table saying what a slot MEANS**, and the color follows:
`ARC_SLOT_CATEGORY` / `LINKED_READ_SLOT_CATEGORY` (`shaders/palettes.ts`) →
`arcSlotCategory(slot, colorField)` → `palette.readCategoryColors[category]`
(`readCategoryColorsOf`, built once per palette over `declaredReadCategoryColors`)
→ the color `color` declares for the category.

A split-read arc's four slots (`features/arcs/arcSplitCategory.ts`) are not read
categories. `arcCategoryColor` resolves three of them through their pair twin's
entry, so a color declared for `pairRL` also moves the duplication-type split
arc. The deletion-type split takes the `splitDeletion` gold of the read fills.

An override reaches the GPU uniforms, the Canvas2D fill, the key and the band
together. **When adding a slot**, add it to the meaning table. Do not add a color,
and do not add a `case` to a classifier that already has a table.

Labels derive the same way: `connectionLabel` reads wording through the read key,
with `SPLIT_JUNCTION_LABELS` (`packages/alignments-core/src/connectionLabels.ts`)
overriding the two junction rows. `getAlignmentsColorScales` de-dupes connections
against keyed rows on `` `${color} ${label}` ``, so a drifted string silently keys
one connection twice.

## What the tests are for

- `shaders/overlayPaletteParity.test.ts` is close to a tautology on color by
  design. Its palette is **all-distinct on purpose**: the stock palette is the one
  configuration where a baked constant passes by coincidence.
- `LinearAlignmentsDisplay/arcReadColorParity.test.ts` holds `getArcColorType`
  against `readColorCategory`. Both classify a pair through `pairCategory`
  (`shared/pairCategory.ts`); what the test pins is the arc side's own gates
  and its category-to-slot fold, under which `pairLR` and `nonSplit` share the
  baseline slot.
- `chromosomePainting.test.ts` sabotage-checks `paintedRefNamePosition`, since both
  failure modes fall back to a plausible color.

## Why divergences survive

Every divergence found here agreed in the configuration everybody looks at (light
mode, clean TLEN, both primaries on screen, slots below 10), and figures are
captured there, so the figure corpus catches none of them. A comment asserting two
things match is a derivation waiting to be written.

**Check a themed path with `pairLR`.** It is the one alignment fill the stock dark
palette overrides. Arcs land 1/255 under the palette value on a dark ground
because their alpha is just under 1; that is expected.

## A shared function does not guarantee parity

`mateRefName` coloring once claimed to share `getQueryColor` with the synteny
view; synteny then moved to positional coloring and the alignments comment kept
describing a function only one side called. Both sides now call `refNameColor`
(core), which hashes only without an assembly position. The alignments position
comes from `paintedRefNamePosition`, **canonicalized first**, because a mate
reference arrives in the file's spelling ([REFNAME_NAMESPACES.md](REFNAME_NAMESPACES.md)).

## Deriving the rule is not the same as calling it

`linkedReadColorSlot` replaced a hand-spelled `colorType % palette.length` at three
sites, and the linked-reads Canvas2D/SVG painter kept the old spelling while the
rule's unit test passed. **Test the caller when the rule is shared.** Slots 0, 1,
7 and 9 share LR's swatch, so the first index that wraps onto a different color
is 10.

`mateLinkArc` sources orientation and TLEN from a primary endpoint
(`pairFieldEntry`), because in chain mode @gmod/bam derives `pair_orientation`
from the record's own reverse bit and a strand-flipped supplementary computes a
different one (`attachChainFields`). `readInsertSizes` is deliberately **not**
corrected that way: an unset TLEN is unknown, a supplementary paints neutral under
`insertSize`, and the orientation schemes mark the split with `CHAIN_SPLIT_*` hues.

## Insert size is TLEN, on both sides

Arc color and read color both classify `|TLEN|` through `pairCategory`;
`absrad` sets only arc height. Declined: coloring arcs by drawn span past a
fixed threshold. `classifyInsertSize` sorts TLEN 0 into `normal`, so
span-colored arcs went red over grey reads on exactly those pairs. The reads
once handed the classifier the signed TLEN as it stood, so the second mate of a
long-insert pair painted `normal`; one function takes the absolute value for
both sides now.
