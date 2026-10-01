---
name: alignments-color-parity
description: How a pileup's three colour vocabularies (read fills, arc overlays, linked-read connectors) are derived from one table rather than tested against each other. Read before touching arc colour or the alignments legend.
audience: internal
kind: spec
---

# Alignments colour parity

A pileup draws one meaning through three vocabularies:

- **read fills** — `readColorCategory` (`colorUtils.ts`) classifies each read
  into a `ReadColorCategory` once, on the CPU; the shader paints the index.
- **arc / read-cloud overlays** — `getArcColorType` (`features/arcs/arcColors.ts`)
  classifies each connection into an arc palette slot.
- **linked-read connectors** — slots `LINKED_READ_COLOR_*`
  (`features/linkedReads/compute.ts`).

All three can share the screen and one legend box, so they have to agree.

## The rule: derive, do not reconcile

Each overlay has **one table saying what a slot MEANS**, and the colour follows:

```
ARC_SLOT_CATEGORY / LINKED_READ_SLOT_CATEGORY   (shaders/palettes.ts)
  -> arcSlotCategory(slot, colorField)          (the arc baseline is LR or normal insert, per mode)
  -> palette.readCategoryColors[category]       (the read fills' own table, built once)
  -> the colour `color` declares for the category, else its named default
```

An overlay slot and the read swatch of the same meaning cannot be two colours,
because one table derives from the other. `readCategoryColorsOf` builds the
table once per palette, with `declaredReadCategoryColors` over the defaults, so
an override reaches the GPU uniforms, the Canvas2D fill, the key and the band
together.

Labels follow the same shape. `connectionLabel` derives wording from the slot's
category through the read key, with `SPLIT_JUNCTION_LABELS`
(`packages/alignments-core/src/connectionLabels.ts`) as the override for the two
junction rows, which the arc overlay reads too. `getAlignmentsColorScales`
de-dupes connections against keyed rows on `` `${color} ${label}` ``, so a
drifted string silently keys one connection twice under two wordings.

**When adding a slot**, add it to the meaning table. Do not add a colour, and do
not add a `case` to a classifier that already has a table.

## What the tests are for

`shaders/overlayPaletteParity.test.ts` is close to a tautology on colour by
design. It catches a path reverting to a baked constant and a slot pointed at
the wrong meaning. Its palette is **all-distinct on purpose**: the stock palette
is the one configuration where a baked constant passes by coincidence.

`LinearAlignmentsDisplay/arcReadColorParity.test.ts` holds `getArcColorType`
against `readColorCategory` over an orientation x insert-size matrix, because
those are still two classifiers.

`chromosomePainting.test.ts` sabotage-checks `paintedRefNamePosition` (below),
since both of its failure modes fall back to a plausible colour.

## Why divergences survive

Each divergence found here agreed in the configuration everybody looks at:

| divergence | agreed in | diverged in |
| --- | --- | --- |
| arc colour vs read colour | pairs with clean TLEN | TLEN 0, and far-apart pairs |
| overlay palette vs read palette | light mode | dark mode, themed deployments |
| connector labels vs read key | the day each was written | any later wording edit |
| connector slot rule, Canvas2D vs GPU | every slot in use | slot 10+ |
| mate-link pair fields | both primaries on screen | a mate whose primary is off-screen |
| chromosome painting vs the synteny views | nothing, once synteny moved | every assembly |

Figures are captured in light mode with well-formed data, so the figure corpus
catches none of these. A comment asserting two things match is a derivation
waiting to be written.

**Check a themed path with `pairLR`.** It is the one alignment fill the stock
dark palette overrides, so it is the only one that can show a themed path that
is not actually themed. Arcs land 1/255 under the palette value on a dark ground
because their alpha is just under 1; that is expected.

## A shared function does not guarantee parity

`mateRefName` colouring once claimed to share `getQueryColor` with the synteny
view's `query` mode. Synteny then moved to positional colouring, and the
alignments comment kept describing a function only one side called, so a
translocation could paint the colour of the reads around it. **One rule being
fixed where the other's comment could not see it** is the shape to watch for
across plugins.

Both sides now call `refNameColor` (core), which takes an assembly position and
hashes only without one. The alignments position comes from
`paintedRefNamePosition`, **canonicalized first**, because a mate reference
arrives in the file's spelling ([REFNAME_NAMESPACES.md](REFNAME_NAMESPACES.md)).

## Deriving the rule is not the same as calling it

`linkedReadColorSlot` (a clamp generated from `alignmentsUniforms.slang`)
replaced a hand-spelled `colorType % palette.length` at three sites, and one
caller — the linked-reads Canvas2D/SVG painter — kept the old spelling while the
rule's own unit test passed. **Test the caller when the rule is shared.** The
divergence hid well: slots 0, 1, 7 and 9 share LR's swatch, so the first index
that wraps onto a different colour is 10.

The mate link drifted the same way. In chain mode `attachChainFields` gives a
supplementary's `readPairOrientations` entry the chain primary's, because
@gmod/bam derives `pair_orientation` from the record's own reverse bit and a
strand-flipped segment computes a different one. `mateLinkArc` sources
orientation and TLEN from a primary endpoint (`pairFieldEntry`) so arcs match
the fills.

`readInsertSizes` is **not** corrected that way, deliberately: under plain
`insertSize` a supplementary (TLEN 0 → `normal`) paints neutral beside its
long-insert primary. An unset TLEN is genuinely unknown, and the orientation
schemes mark the split with `CHAIN_SPLIT_*` hues.

## Insert size is TLEN, on both sides

Arc colour and read colour both classify `|TLEN|`; nothing reads the drawn span
for colour, and `absrad` sets only arc height. Declined: colouring arcs by span
past `LARGE_INSERT_THRESHOLD` to catch discordant pairs with unreliable TLEN.
`classifyInsertSize` sorts TLEN 0 into `normal`, so span-coloured arcs went red
over grey reads on exactly those pairs.

`readInsertSizes` is already `Math.abs(template_length)` (set in
`buildBaseFeatureData`), so a negative TLEN is not a source of divergence.
