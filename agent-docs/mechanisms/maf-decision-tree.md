---
name: maf-decision-tree
description: What a multiple-alignment track decides — which of two tiers a fetch reads, which rendering the rows are painting, what colour one aligned base takes, and how a species becomes a placed row — as four rendered decision graphs, each stated against the naive version it replaced. Read before touching the summary threshold, a row rendering, the cell colour table or the height ladder.
audience: internal
---

# The multiple-alignment decision tree

A MAF track is a stack of per-species rows over one reference, and nearly every
decision in it follows from that shape: a row is a *genome* rather than a
feature, so the worker cannot know where it goes; the rows are the payload, so
the payload is enormous; and the rows can be coloured by five fields, two of which cannot draw at every
zoom.

Four questions:

- **the tier** — which file a fetch reads, and what each gate is measuring.
- **the rendering** — which colouring the rows are painting, on which surface.
- **the cell** — what colour one aligned base takes.
- **the layout** — how a species becomes a placed row, and how tall it is.

Where the worker's time goes is
[reference/MAF_WORKER_PIPELINE.md](../reference/MAF_WORKER_PIPELINE.md); why long
alignment blocks are expensive and why clipping them is the wrong fix is
[reference/MAF_LARGE_BLOCKS.md](../reference/MAF_LARGE_BLOCKS.md). The depth on
both stays there.

## The tier

![Which tier a MAF fetch reads, and what each gate measures](diagrams/maf-tier.svg)

The naive version is one adapter behind one gate. There are three files here,
and the gate has to know which one it is talking about.

**The swap point and the size gate are different questions.** Where the cheap
per-species summary starts being the better *picture* is a rendering question;
where the full alignment stops being affordable is a bytes question. They used
to coincide only because the gate had nothing to say at that zoom.

**Each tier is measured against the file it will actually read.** A gate wired
to one adapter while the fetch reads another is describing a download that is
not happening — in either direction. The summary tier was once exempt on the
grounds of being the cheap one; cheap *per base* is not cheap, and that
exemption was the one path that could pull an unbounded read with nothing
quoting its size.

**An auxiliary read gets a private budget, and reports that it used it.** The
CDS-frame file piggybacks on whichever tier won, so the main gate never sees it.
It declines quietly rather than raising a banner about the wrong download — but
it records the refusal, so a strip that stopped drawing can say why instead of
looking broken.

**The two tiers cache side by side, and clear in one direction only.** That is
what makes zooming back out free; which map holds the region is the cache test,
not a key over the tier's name.

## The rendering

![Which rendering the per-sample rows are painting](diagrams/maf-rendering.svg)

The display states what colours the rows as two channels: `color`, whose field
names the variable (mismatch, base, identity, chromosome, codon), and `y`, which
puts identity on each row's bar height. They are independent, so identity bars
can take the identity ramp. What is left to decide is what each channel can draw
at the current zoom.

**The setting and the active rendering are different getters.** The one the
radio ticks is zoom-independent, or the tick moves as the user zooms, which
reads as the app changing the setting behind their back. `rowsColor` and `rowsY`
apply the overrides — the summary tier carries no bases, codons exist only at
base level with a frames file, and identity yields to the letters at base level
— and every painter branches on those.

**Every rendering is a GPU mark over one encode per region.** A pan moves
uniforms rather than re-walking the blocks. `basesRenderingActive` now only says
whether the letters, insertion markers and deletion counts draw over the cells,
so the hover and menu consult it too: an insertion under the cursor is only an
answer while insertions paint.

## The cell

![What colour one aligned base takes](diagrams/maf-cell-colour.svg)

The naive version is a branch cascade returning a colour, spelled once in each
painter. Both halves of that are wrong here. Only `color: 'base'` paints a
matching base in its own colour; every other field leaves matches in the match
tone.

**The cascade returns a category, not a colour**, and each representation maps
from it — CSS strings for Canvas2D, packed integers for the instance buffer.
Two painters that each spell out the decision drift, and the drift shows up as
pixels differing between backends rather than as a failure.

**The cascade is then memoized over its whole input domain**, because this
encoder runs on the *main thread* over every base of every row.

**What makes that pay is building the table without running the cascade.**
Filling every slot the honest way pushed breakeven past a typical viewport, so
the table only won on the frames that did not need it. The table has structure —
every row is one shared row with two entries patched — and exploiting it turns
the build into a memcpy.

**The skip case stays outside the table.** A packed colour uses the full integer
range, so no value inside it can safely mean "don't draw".

## The layout

![How a species becomes a placed row, and how tall it is](diagrams/maf-layout.svg)

The naive version has the worker assign row indices. It cannot: the row order is
a display concern, and it changes without the data changing.

**The wire names rows by species; the client places them.** So a reorder
re-places the payload already in memory instead of refetching the heaviest
thing in the plugin, and the row *set* is a fetch key while the row *order* is
not. The projection that does the placing has to be the same one the labels,
overlays and hit test read, or the payload and its labels disagree about which
row is which.

**A species the display is not listing is dropped, not parked at a sentinel** —
everything downstream keys on the row index and would collide on a shared one.

**A band's height follows its data, not its setting.** The user's tick says what
they want; whether the band has anything to put in it is a second question, and
answering both with the setting reserved space and painted nothing into it.

**Fit mode is not floored at one pixel.** A sub-pixel row is the legitimate
answer for more species than the track has pixels, and flooring it made the rows
area taller than the height it was asked to fit inside.

## What transfers

**Name a row by its identity in the producer, place it in the consumer.** The
expensive half of a payload like this is the rows; the cheap half is which slot
each one lands in. Splitting them that way makes a reorder a re-place of memory
you already have, and makes the row *set* the only part of the arrangement that
can invalidate a fetch.

**When a setting can be overridden, the setting and the override are different
getters — and sometimes there are three.** The one the UI ticks must not move as
the user navigates. The one the painters read must apply the overrides. A third
appears wherever "which choice won" and "can this surface draw it" genuinely
differ.

**Gate each tier against the file it will actually read, and give an auxiliary
read its own bound.** A gate pointed at the wrong adapter measures a download
that is not happening. A side fetch that piggybacks on the main one is invisible
to the main gate, and "this one is cheap" is a premise rather than a bound — so
it needs a private budget, and a way to say when it used it.

**Classify into a category, then map the category to each representation.** One
cascade producing a named category, with a small mapping per painter, makes
divergence between backends impossible to write rather than merely unlikely.

**Memoize a cascade over its whole domain — but build the table without running
it.** Precomputing every answer is the obvious win and the obvious cost, and the
cost is what decides it. Finding the structure in the table is usually what
moves breakeven under a typical workload.

**Decimate by sampling only where the sub-pixel race is already lost.** One
sample per bin is unbiased precisely because the surviving mark was arbitrary
anyway. The reasoning inverts for any layer painting an *average*: there the
skipped samples are the ones the average is made of, and the identical
optimization turns a smooth ramp into noise.
