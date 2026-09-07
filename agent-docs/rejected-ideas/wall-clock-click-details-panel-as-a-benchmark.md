---
name: wall-clock-click-details-panel-as-a-benchmark
description: Wall-clock "click → details panel" as a benchmark
area: performance-and-measurement
---

# Wall-clock "click → details panel" as a benchmark

do not trust it, and
do not quote a speedup from it without reading this. `fetchCanvasFeatureDetails`
re-fetches the feature through the adapter, so a **remote read sits inside the
measured window**; on a hosted hub that is network variance, not app cost. A
paired A/B across two builds served side by side gave `baseline=1010ms
fixed=579ms` in one round and `fixed=1338ms baseline=872ms` in the next, and a
bare before/after on the same box drifted from 871ms to 330ms for the *same*
build once an unrelated dev server was killed. Substituting main-thread CPU
from a sampling profile does not rescue it either — `(program)` (GC, JIT,
native) is ~700-900ms of it and swamps the signal.

What *is* attributable is per-frame profile time within a single run, which is
how the numbers in the entry above and in `applyFormatDetails`' fast path were
obtained. Judge a change on the work it provably stops doing, and keep the
claim to that.
