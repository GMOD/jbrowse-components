---
name: alignments-color-parity
description: How a pileup's three colour vocabularies (read fills, arc / read-cloud overlays, linked-read connectors) are kept saying the same thing, why they are derived from one table rather than tested against each other, and the one meaning still split between them. Read before touching arc colour, the connector palette, or the alignments legend.
audience: internal
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
| connector slot rule, Canvas2D vs GPU | every slot in use | slot 10+ (see below) |
| mate-link pair fields | both primaries on screen | a mate whose primary is off-screen |
| chromosome painting vs the synteny views | nothing, once synteny moved | every assembly (see below) |

Every one was described correctly in a comment and enforced by nothing. Figures
are captured in light mode with well-formed data, so the corpus could not catch
any of them. That is the pattern to look for elsewhere in the plugin: a comment
asserting two things match is a derivation waiting to be written.

## The parity claim that outlived the thing it named

`mateRefName` ("Mate chromosome"; "Query name" on LGVSyntenyDisplay) said in
`colorSchemes.ts` that it and the synteny view's `query` mode "both go through
core's getQueryColor, so one contig paints the same color in both views". They
did once. Synteny then moved to `paletteColorAt` — handing the palette out by
position in the assembly, with re-lit laps — after a figure review caught rice's
twelve chromosomes colliding in nine hash buckets. The alignments sentence was
not edited, so it went on describing a shared function only one side still
called.

**That is a fourth shape, and the one to watch for across plugins**: not two
rules drifting, but one of them being fixed somewhere the other's comment could
not see. Both had a single named function; the parity failed anyway.

What the alignments side was left painting, measured on hg38 through
`bakedValueColor` itself: 25 chromosome names onto **10** colours, every one of
them shared. `chr1 chr12 chr21 chrY` are one pink, `chr2 chr13 chr22` are
category10's grey — the slot the synteny palette deliberately drops for reading
as "uncolored/broken". So from a chr1 view, a translocation to chr12 painted
exactly the colour of the reads around it, in the scheme whose whole purpose is
showing translocations.

Now both sides call `refNameColor` (core, beside `getQueryColor`), which takes a
position and hashes only when there is none. The alignments position comes from
`paintedRefNamePosition`, the twin of `LinearSyntenyDisplay.paintedChromosomeOrder`
— **canonicalized first**, because a mate reference is `next_ref` and arrives in
the file's spelling (REFNAME_NAMESPACES.md). Both halves fail silently, so both
are sabotage-checked in `chromosomePainting.test.ts`: dropping the
canonicalization and dropping the whole position both fall back to a real,
plausible colour.

## Deriving the rule is not the same as calling it

The last two rows are a variant worth naming separately, because the doctrine
above had already been applied to both and they still diverged: what drifted was
a **call site**, not a rule.

`linkedReadColorSlot` (a clamp, generated from `alignmentsUniforms.slang`)
replaced a hand-spelled `colorType % palette.length` at three sites. Two moved
onto it; `features/linkedReads/drawCanvas.ts` — the Canvas2D/SVG twin of the GPU
straight-line pass — did not, and its own unit test
(`arcYScale.test.ts::linkedReadColorSlot`) passed throughout, because it tests
the rule. **Test the caller when the rule is shared**; a rule with three callers
and one test proves nothing about the other two.

That one hid unusually well even for this file. Slot 7 is the unknown/fallback
baseline and takes LR's swatch, the same colour slot 0 takes, so the first
out-of-range index (`8 % 8 === 0`) *happened* to paint the clamp's answer; slots
1 and 9 are LR as well. Index 10 is the first that wraps onto a colour of its
own. So the usual "diverges only out of range" was itself masked twice over.

The mate link is the other shape: `buildChainResultFields` overwrites a
supplementary's `readPairOrientations` entry with the chain primary's, because
`pair_orientation` is derived (in @gmod/bam) from the record's own reverse bit
and position and a strand-flipped segment computes a different one. The arcs read
that same array — so in **chain** mode they got the corrected value and in
**pileup** mode they did not, the same reads at the same locus taking a different
arc colour from a layout setting. `mateLinkArc` now sources orientation and TLEN
from a primary endpoint itself (`pairFieldSource`), which is a no-op when both
primaries are loaded since the two primaries of a pair always agree.

A related inconsistency is **open and deliberate**: `readInsertSizes` is not
corrected the way `readPairOrientations` is, so under the plain `insertSize`
scheme a supplementary segment (TLEN 0 → `normal`) paints neutral beside its
long-insert primary within one chain. Defensible — an unset TLEN is genuinely
unknown, and the orientation-flavoured schemes cover the split with their own
`CHAIN_FILL_SPLIT_*` hues — but it is the same question answered the other way,
so decide it rather than rediscover it.

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
