---
name: the-interbase-stack-overruns-its-half-band-at-a-split-read-breakpoint
description: at a clean breakend the interbase stack is scaled by the region's peak read depth while the events at one boundary can sum to twice it, so the bar runs into the coverage bars at exactly the locus someone navigates to — measured at 2.0x, both backends identical so the gate is blind to it, and three fixes each lose something the current form chose; a visual call, not a release blocker
---

# The interbase stack overruns its half-band at a split-read breakpoint

Moved out of [TODO.md](../TODO.md) on 2026-09-02. It is a measured picture
defect, not a regression and not something v5.0.0 turns on: the overflow needs
a breakend at the region's depth peak with no spanning reads, the clamp was
objected to on the record, and the other two fixes each give up a property the
current scaling chose. It waits on a visual call, which is the same reason the
release list cannot hold it.

`computeInterbaseCoverage` bakes each stacked segment as `count /
interbaseMaxCount`, where the denominator is the region's PEAK READ DEPTH. At a
clean breakend the events at one boundary can exceed that peak, because neither
group of reads covers the other's base: N reads end at P and M start at P, so
the peak is `max(N, M)` while the events at P total `N + M`. Nothing clamps the
sum — not `coverageInterbase.slang`, not `drawInterbaseSegments` — so the bar
runs past the half-band it is scaled against and into the coverage bars.

Measured with the real functions, N = M = 40 and no spanning depth:

```
peak read depth: 40      events at P: 80      denominator: 40
tallest stackEnd: 2.000  (1.0 is the full-scale bar)
bar drawn: 90.0px        half-band budget: 45.0px
```

i.e. it eats 50% of the coverage bars' own drawing area, at exactly the locus
someone navigates to when they care. Two things bound how often it is seen, and
both are real: spanning coverage at P raises the denominator, and the
denominator is the peak over the WHOLE region, so a breakpoint away from the
region's depth peak cannot overflow.

**Both backends overflow identically, so the cross-backend gate cannot see
this** — it is the shared-bug blindness `crossBackendGate.ts` declares in its own
header, and this is a worked instance of it.

The visual call, which is why this is parked rather than fixed:

- **Clamp the stack to 1.0.** Stops the overdraw. Loses the signal that there
  are more clip events here than the region's peak depth, which is arguably the
  most interesting thing on the screen — and a flat-topped bar says "exactly at
  peak" when it means "over it". Raised and objected to on exactly that ground;
  do not treat it as the default.
- **Leave it.** The overflow is informative, and overdrawing the bars it is
  meant to be read against misleads in the other direction.
- **Change the denominator to local depth at the position.** Makes the ratio
  meaningful per position, and gives up what `interbaseBarHeightPx` chose
  regionally for: a bar of N events being the same height everywhere in the
  view.
