---
name: fusing-the-synteny-worker-s-dedupe-into-the-decorate-pass
description: Fusing the synteny worker's `dedupe` into the decorate pass that follows it
area: performance-and-measurement
---

# Fusing the synteny worker's `dedupe` into the decorate pass that follows it

measured 2026-08-20 and declined. The two passes read `id()` twice and
allocate two intermediate arrays the length of the fetch, so one pass over a
`Set` looked like free money. It measured **1.00-1.01x** on a 14,599-feature
whole-genome fetch against a control of 1.02-1.06x, i.e. nothing, and it moves
a subtle distinction into a loop body: only the query-axis fetch is
id-deduped, because PIF and all-vs-all give one record's two perspectives
unrelated ids on purpose and `flippedRibbons` must stay out of that set.
`plugins/linear-comparative-view/benches/syntenyRpc.bench.ts --base=<ref>` is
what measured it, and is the way to re-check any candidate here.

**The generalizable half**: at this scale, removing an allocation is not a
measurable win. The same session's two accepted changes both removed *work*
proportional to a product — rows x regions, and a hash per channel per feature
— and both showed up immediately. The off-screen-mate scratch above is the
same lesson from the other side: there the allocation removal was measurable
and still lost, because it moved the cost onto a hotter path.
