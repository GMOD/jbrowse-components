---
name: colouring-an-arc-long-insert-from-the-pair-s-drawn
description: Colouring an arc long-insert from the pair's drawn SPAN
area: rendering-and-displays
---

# Colouring an arc long-insert from the pair's drawn SPAN

shipped, then
removed. `getArcColorType` overrode the TLEN class whenever the mates sat more
than `LARGE_INSERT_THRESHOLD` apart, on the sound ground that a discordant pair
often carries an unreliable or 0 TLEN. The read fills never had the rule, so
the two disagreed on exactly the pairs it existed to catch:
`classifyInsertSize` sorts TLEN 0 into `normal`, so those arcs went red over
grey reads, and a figure shipped that way. Half the test was also
`absrad >= longRangeThreshold`, a median+MAD cut over the arcs IN VIEW, so an
arc's colour depended on what else was on screen and changed as you panned.
**What was given up:** pairs whose TLEN is 0 or wrong are `normal` on both
sides rather than long-insert on one. Restoring it means giving the READ path
the same span rule — a worker-data change, since it has no mate span today —
not reintroducing it on the arc side alone. See
[ALIGNMENTS_COLOR_PARITY.md](../reference/ALIGNMENTS_COLOR_PARITY.md).
