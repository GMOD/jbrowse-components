---
name: three-replacements-for-the-synteny-auto-fade-s-mean-block
description: Three replacements for the synteny auto-fade's mean block width
area: comparative-and-pangenome
---

# Three replacements for the synteny auto-fade's mean block width

, measured
2026-08-21 and declined in favour of capping each block at 2 px
([ADR-083](../architecture-decision-records/adr-083-the-auto-thin-fade-averages-capped-widths.md)).
The complaint is real: a plain mean follows the widest blocks, and on a
liftOver chain (`hg38ToHs1.over.pif`, chr1) it read 2.48 px over a view whose
blocks were 96% sub-pixel, so `'auto'` faded 0% of a whole-chromosome pan at
every zoom. **The median** — the statistic "predominantly sub-pixel" actually
names — costs 5 to 11 extra fade flips per chromosome pan at 5–10 Mb views,
because that population swings 7 → 155 blocks per rollover and the median hops
between the file's 130 bp mode and its 10 Mb one. **Sub-pixel ribbons per
pixel** is the steadiest signal measured and the one ADR-033's prose implies,
but at 0.5/px it never fires on that file at all (peak 0.45/px at 1000 px,
0.11/px at 4000 px) and it stops fading `peach_grape` on a wide window.
**Restricting the statistic to the visible window** — measure what is on
screen — is the worst of the four: 5 to 29 flips per pan against 1, because the
fetch window's pan buffer is what makes the sample big enough to threshold, and
roughly 80% of it is off-screen by design. Nor can the latch go: the steadiest
candidate still flipped three times in one pan on a single threshold.
