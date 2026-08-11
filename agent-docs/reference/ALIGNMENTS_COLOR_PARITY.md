---
name: alignments-color-parity
description: How a pileup's three colour vocabularies (read fills, arc / read-cloud overlays, linked-read connectors) are kept saying the same thing, why they are derived from one table rather than tested against each other, and the one meaning still split between them. Read before touching arc colour, the connector palette, or the alignments legend.
---

# Alignments colour parity

A pileup draws one meaning through three vocabularies:

- **read fills** — `readColorCategory` (colorUtils.ts) classifies each read into
  a `ReadColorCategory`, once, on the CPU; the shader paints the resulting index.
- **arc / read-cloud overlays** — `getArcColorType` (features/arcs/compute.ts)
  classifies each connection into an arc palette slot.
- **linked-read connectors** — the bezier/straight curves, whose slots are
  `LINKED_READ_COLOR_*` (features/linkedReads/compute.ts).

All three can be on screen at once, over the same reads, and the legend can show
rows from all three in one box. So they have to agree, and the interesting
question is *how* the agreement is enforced.

## The rule: derive, do not reconcile

Each overlay has **one table saying what a slot MEANS**, and the colour follows:

```
ARC_SLOT_CATEGORY / LINKED_READ_SLOT_CATEGORY   (shaders/palettes.ts)
  -> swatchPaletteKeys[category]                (colorUtils.ts — the read fills' own table)
  -> the themed ColorPalette
```

An overlay slot and the read swatch of the same meaning therefore cannot be two
colours. Not because a test says so — because there is one table and the other
is derived from it. `readCategoryPaletteKeys` had always worked this way for the
reads themselves; the overlays were the ones off it.

The same shape covers the words. `connectionLabel` derives its wording from the
slot's category through the read key, with `SPLIT_JUNCTION_LABELS` (legendUtils)
as the documented override for the two junction rows — which the arc overlay
reads too. This matters mechanically, not just aesthetically:
`getAlignmentsLegendSections` de-dupes the connections section against the
already-keyed rows on `` `${color} ${label}` ``, so a drifted string silently
keys one connection twice in one box under two wordings.

**When adding a slot**, add it to the meaning table. Do not add a colour, and do
not add a `case` to a classifier that already has a table.

## What the tests are for now

`shaders/overlayPaletteParity.test.ts` is deliberately close to a tautology on
the colour half. It still buys two things: that the wiring is intact (a path
reverting to a baked module constant fails), and that no slot is pointed at the
wrong meaning. Its palette is **all-distinct on purpose** — the stock palette is
the one configuration where a baked constant passes by coincidence.

`LinearAlignmentsDisplay/arcReadColorParity.test.ts` holds `getArcColorType`
against `readColorCategory` over an orientation x insert-size matrix. These are
still two classifiers (see the open item below); this is what stops them
disagreeing again.

## Why the bugs here survived so long

Three separate divergences shipped, and each one agreed in exactly the
configuration everybody looks at:

| divergence | agreed in | diverged in |
| --- | --- | --- |
| arc colour vs read colour | pairs with clean TLEN | TLEN 0, and far-apart pairs |
| overlay palette vs read palette | light mode | dark mode, themed deployments |
| connector labels vs read key | the day each was written | any later wording edit |

Every one was described correctly in a comment and enforced by nothing. Figures
are captured in light mode with well-formed data, so the corpus could not catch
any of them. That is the pattern to look for elsewhere in the plugin: a comment
asserting two things match is a derivation waiting to be written.

## Insert size is TLEN, on both sides

`getArcColorType` used to override the TLEN class with the pair's drawn SPAN —
mates more than `LARGE_INSERT_THRESHOLD` apart painted long-insert whatever TLEN
said — on the ground that a discordant pair often carries an unreliable or 0
TLEN. The read fills never had that rule, so the two disagreed on precisely the
pairs it existed to catch: `classifyInsertSize` sorts TLEN 0 into `normal` (0 is
neither `> upper` nor inside `(0, lower)`), so those arcs went red over reads
that stayed grey.

Both sides read TLEN now, and nothing reads the span for colour. `absrad`
survives only as arc *height*, which is geometry. See REJECTED_IDEAS for the
capability that was given up with it.

`readInsertSizes` is already `Math.abs(template_length)` — set at extraction in
`buildBaseFeatureData` — so neither side needs to abs it and a negative TLEN is
not a source of divergence. It looks like one; it is not.

## The one meaning still split

A pair with **no computed orientation (`po === 0`)** is `nonSplit` to the read
fills — deliberately the neutral grey, "distinct from the strand-colored split
segments" — while the arcs have no such slot and fall to their baseline, which
is `pairLR`. `swatchPaletteKeys` maps those to `colorNostrand` and
`colorPairLR`: two greys, not the same grey, and two legend rows for one thing.

Pinned by the last `describe` in `overlayPaletteParity.test.ts`. Closing it is a
decision rather than a refactor — see TODO.
