---
name: alignments-color-parity
description: How are a pileup's two color vocabularies (read fills, and the read connections the arcs, read cloud and connectors draw) kept in agreement, and what constrains each slot's value? Read before touching arc color, a read-fill color or the alignments legend.
audience: internal
kind: spec
---

# Alignments color parity

A pileup draws one meaning through two vocabularies that share the screen and
one legend box: read fills (`readColorCategory`, `colorUtils.ts`), and the read
connections (`features/arcs/arcColors.ts`). The arcs and the read cloud take
`getArcColorType`'s slot, and a connector over the pileup carries the slot
`classifyPair` gives it. Both paint `insertSizeAndOrientation`, the one
paired-end color field; a connection has no color field of its own. The color
object and scale vocabulary are [MARK_ENCODING.md](MARK_ENCODING.md)'s.

## The rule: derive, do not reconcile

The read connections have **one table saying what a slot MEANS**, and the
color follows: `ARC_SLOT_CATEGORY` (`shaders/palettes.ts`) →
`arcSlotCategory(slot)` → `palette.readCategoryColors[category]`
(`readCategoryColorsOf`, built once per palette over `declaredReadCategoryColors`)
→ the color `encoding.color` declares for the category.

A split-read arc's five slots (`features/arcs/arcSplitCategory.ts`) are not read
categories. `ARC_SPLIT_SWATCH` names the read swatch each paints, so a color
declared for `pairRL` also moves the duplication-type split arc, the
insertion split paints `shortInsert` as a too-close pair does, and the
deletion-type split takes the `splitSameStrand` gold of the read fills.
A split takes its class under both color fields: neither has a value for a
junction, and the baseline slot would key it as a normal pair.

An override reaches the GPU uniforms, the Canvas2D fill, the key and the band
together. **When adding a slot**, add it to the meaning table. Do not add a color,
and do not add a `case` to a classifier that already has a table.

Labels derive the same way: `arcColorCategoryLabel` reads wording through the
read key, with `ARC_SPLIT_LABELS` naming the five junction rows. The band's
colors and the pileup connectors' are one key list (the model's
`connectionLegendItems`), since they paint one field through one palette, and
the interchromosomal row reads "Inter-chromosomal" whether a split read or a
mate pair draws it, as the color says only that the connection crosses.

## What the tests are for

- `shaders/overlayPaletteParity.test.ts` is close to a tautology on color by
  design. Its palette is **all-distinct on purpose**: the stock palette is the one
  configuration where a baked constant passes by coincidence.
- `LinearAlignmentsDisplay/arcReadColorParity.test.ts` holds `getArcColorType`
  against `readColorCategory`. Both classify a pair through `pairCategory`
  (`shared/pairCategory.ts`); what the test pins is the arc side's own gates
  and its category-to-slot fold, under which `pairLR` and `noOrientation` share the
  baseline slot.
- `chromosomePainting.test.ts` sabotage-checks `paintedRefNamePosition`, since both
  failure modes fall back to a plausible color.

## Why divergences survive

Divergences agree in the configuration everybody looks at (light mode, clean
TLEN, both primaries on screen, slots below 10), and figures are captured there,
so the figure corpus catches none of them. A comment asserting two things match
is a derivation waiting to be written.

**Check a themed path with `alignmentFill.read`.** It is the one alignment fill
the stock dark palette overrides. Arcs land 1/255 under the palette value on a
dark ground because their alpha is just under 1; that is expected.

## A shared function does not guarantee parity

Both sides of `mateRefName` coloring call `refNameColor` (core), which hashes
only without an assembly position. The alignments position comes from
`paintedRefNamePosition`, **canonicalized first**, because a mate reference
arrives in the file's spelling ([REFNAME_NAMESPACES.md](REFNAME_NAMESPACES.md)).

## Deriving the rule is not the same as calling it

`linkedReadColorSlot` is the one spelling of the slot-to-palette index. **Test
the caller when the rule is shared**, with a palette whose slots are all
distinct colors, so an index that wraps lands on a color of its own: the
linked-reads Canvas2D/SVG painter once kept a hand-spelled
`colorType % palette.length` while the rule's unit test passed.

`mateLinkArc` sources orientation and TLEN from a primary endpoint
(`pairFieldEntry`), because in chain mode `pair_orientation` comes from the
record's own reverse bit (`@gmod/bam`'s `pair_orientation` and
`pairOrientation`, `@gmod/cram`'s `getPairOrientation`) and a
strand-flipped supplementary computes a
different one (`attachChainFields`). `readInsertSizes` is deliberately **not**
corrected that way: an unset TLEN is unknown, and the orientation fields mark the
split with `CHAIN_SPLIT_*` hues.

## Insert size is TLEN, on both sides

Arc color and read color both classify `|TLEN|` through `pairCategory`, which
takes the absolute value for both sides; `absrad` sets only arc height.
Declined: coloring arcs by drawn span past a fixed threshold.
`classifyInsertSize` sorts TLEN 0 into `normal`, so span-colored arcs went red
over grey reads on exactly those pairs.

## A slot's color is chosen against its neighbours

A read-fill slot sits beside every other slot of the mate-aware schemes as a
large flat fill, and a slot in `ARC_SLOT_CATEGORY` also as a 1–2 px arc stroke.
A value has to survive both weights on `#ffffff` and on `#121212`. The numbers
below are CIELAB L\*, C\*, h and ΔE76, and WCAG contrast; moving one slot means
re-checking every neighbour its entry names. The constants live in
`packages/core/src/ui/palette.ts`.

- **`colorInterchrom` `#af4d19`** (L\* 44.9, C\* 60.1, h 52) was chosen with
  `colorUnmappedMate`: while that slot was a warm brown 4.5° away, every move of
  this one ran into it. With the unmapped mate neutral, this takes the warm
  band: ΔE 42.2 to its nearest neighbour, `colorSupplementary`, and contrast
  5.39 on white and 3.48 on `#121212`. Its hue stays clear of
  `colorLongInsert` (h 40), since a second red would read as a second statement
  about insert size. Another hue has no room: the widest gap in the schemes is
  the 91° between `colorPairLL` and `colorPairRL`, whose midpoint reads as a
  second green-blue. The slot must be neither the darkest nor the dullest in
  the scheme; at L\* 35 and C\* 20 (`#6e4b3a`) its 2 px arcs vanished on
  `cancer_sv/k562_bcr_abl_split`.
- **`colorShortInsert` `#f582c0`** (L\* 68.9, C\* 52.7, h 346) has two
  neighbours at opposite ends of lightness: `colorLongInsert` `#ff0000` (L\*
  53.2), its sibling statement, and `colorPairLR` `#d3d3d3` (L\* 84.6), the
  concordant pairs it must be picked out from. They are 31 L\* apart, so no
  value is more than about 16 L\* from each, and this one splits the budget:
  ΔE 86.2 to the red, 54.9 to the grey, contrast 2.38 on white. Hue 346, on
  the magenta side of red, separates what lightness cannot. Pale pinks reach
  the grey (`#ffbcd8` is 1.5 L\* from it, contrast 1.56 against the grey's
  1.50, separated by chroma alone, which a 1 px arc does not carry); saturated
  ones reach the red (`#ff3a8c`, 5 L\* away at h 1); red's own hue washed out
  (`#ffc0cb`) reads as a faded red. As a read fill its C\* stays in the band of
  `colorPairLL` (52.0) and `colorSupplementary` (42.1).
- **`colorUnmappedMate`** is `#000000` on white and `colorUnmappedMateDark`
  `#4a4a4a` on `#121212`. It is a neutral for the reason `readOverlap` is one:
  nothing about the pair's geometry is answerable, and a hue reads as one more
  category beside the LL and RR fills. It does not invert as `readOverlap`
  does, because it fills a whole read, which reads as a dim read where a dark
  span inside a read reads as a cut. On white, black is ΔE 36.1 from
  `readOverlap` `#555555`, and anything lighter crowds it (`#2e2e2e` 17.2,
  `#3d3d3d` 10.4). On `#121212`, everything up to `#1e1e1e` is 1.12 against the
  ground and paints a hole, so the value climbs only as far as reading as a
  block in a 4 px row: L\* 31.5, contrast 2.11, still the darkest fill by 9.7
  L\* (`colorPairRR` next). `#3a3a3a` clears the ground as a swatch (1.65) but
  not as a pileup row, and white on dark is the loudest mark in the pileup, the
  glare `colorPairLRDark` avoids. It is a read fill only, never an arc. IGV
  leaves an unmapped mate the default read color (`setPairOrientation`
  requires `mate.isMapped()`); a mark stays here because under insert size its
  TLEN of 0 would otherwise paint `colorShortInsert`.
- **`readOverlap`** (`#555555`, dark `#e4e4e4`) marks a span where two
  segments of one molecule both align, and has one job: read as neither
  segment. A shade of either segment's color says "more of that one" (on a
  foldback, extra-inverted). It is a neutral outside the read greys, past the
  dark end on white and past the light end on `#121212`, clear of
  `colorPairLRDark` `#b0b0b0`. It inverts rather than dimming because a
  charcoal span on a dark track reads as the ground showing through.
- **`readMateOverlap`** (`#b4b4b4`, dark `#c8c8c8`) makes the same statement one
  step from the read fill: a short-fragment library (exome, cfDNA) overlaps
  nearly every pair, and the strong neutral turned its pileup into dark blocks.
  Chosen on NA12878 exome and 30x WGS captures at BRCA1. On white it is L\*
  73.3 against the read's 84.6; `#a0a0a0` (65.9) weighed down every exome row
  and `#c4c4c4` (79.2) could not be found at a 7 px row. On `#121212` it is L\*
  80.6 over `colorPairLRDark`'s 71.8; `#d4d4d4` glared and `#bcbcbc` (76.2)
  vanished into the reads.
- **`readThroughHidden`** (`#2e2e2e`, dark `#ffffff`) is a neutral because the
  connector is no junction of the read, so no junction class color applies. It
  sits past `readOverlap` on the same side, so the connector stays apart from
  the overlap box it often starts at; on dark, `#f0f0f0` was 4 L\* from
  `readOverlap` and the two key rows could not be told apart.
