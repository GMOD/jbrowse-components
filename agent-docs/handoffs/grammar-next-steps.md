---
name: grammar-next-steps
description: What the grammar thread does next as of 2026-09-27 - wiggle onto the bar and point shapes (parked on a call in ideas/), and one leftover of the domainQuantile call. Read before picking up grammar work.
---

# Grammar thread: next steps

ADR-181 (a centred point and a `rule` mark), ADR-179's 2026-09-27 amendment
(each quantile end clips its own tail), ADR-182 (`scales.y.zero`, the axis's
0 as a slot and a Score-menu tick) and ADR-183 (the red clip strip) landed
that day. Figure reshoots wait on ada
and are listed in [scales-and-colour-keys](scales-and-colour-keys.md).

## Next, ranked

A review on 2026-09-27 checked each candidate against main. Its sizes and
probes come from that review and nobody has re-measured them.

1. **Wiggle's xyplot and scatter onto render-core's `bar` and `point`**, parked
   on a call:
   [ideas/waiting-on-a-call/wiggle-onto-bar-and-point.md](../ideas/waiting-on-a-call/wiggle-onto-bar-and-point.md).

The 2026-09-25/26 reviews' findings all landed by 2026-09-27: the link
mark's log floor, ring placement, hover box and alias-spelt pair, and
domainQuantile's range check and Clip-outliers re-tick.

## Leftover of the domainQuantile call

**Ties fill a nearest-rank quantile**: at 0.95 a segmented copy-number track
pins 99.5% of its values to one colour, because one value holds the rank. It
surfaced in the probe behind the 2026-09-27 amendment and nothing decides it
yet.
