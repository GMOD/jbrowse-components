---
name: a-main-thread-weakmap-index-for-the-coverage-band-hover
description: A main-thread `WeakMap` index for the coverage-band hover readers
area: performance-and-measurement
---

# A main-thread `WeakMap` index for the coverage-band hover readers

shipped,
then removed in favour of sorting at the producer, and the measurements are worth
keeping because the memo looked free at every call site. It answered "which
entries sit at this position" in log time, keyed on the positions array itself,
and it cost:

- **8.00 bytes an entry**, measured against the allocator. That is **2.00x**
  the positions array it indexed, but the figure that decides is the absolute:
  **7.6 MB per 1M-entry array**, retained per region per stacked track,
  invisibly.
- **An invalidation invariant nothing enforced.** Correct only because a
  refetch replaces the array wholesale; anything mutating one in place got a
  silently stale index.
- **A silent wrong answer per unkeyed parameter.** `stride` was not in the key,
  so one array read at two strides got whichever index was built first — a
  property of identity-keyed caches, not of that one bug.
- It was also **slower than not having it**: 1.2-1.4x per hover, from the
  `order[k]` indirection.

What replaced it: producers emit ascending positions, so readers binary-search
what they were given and retain nothing. `mismatchPositions` is sorted
outright; `interbasePositions` within each of its (insertions, softclips,
hardclips) blocks, since three GPU passes slice on those boundaries. Sorting
inside the blocks shipped nothing extra, which is why it beat the
shipped-order-array design parked in TODO.md.

The one-off moved rather than vanishing: the worker pays 20-21ms on a 1M-event
fixture where the main thread paid 10ms on the first hover after each fetch,
larger because it permutes four parallel arrays as well as sorting. Priced in
`benches/hoverIndex.bench.ts`, which keeps the memo as a transcribed arm so a
proposal to bring one back has to beat the sorted column rather than the scan.

**The generalisable rule: ask whether a PRODUCER exists before caching a
derivation.** Three of these were on paths whose arrays we build ourselves, one
fetch earlier, off the interaction path. A fourth had no producer and was
simply wrong — `deletionSpanIndex` was keyed on `gapPositions` while indexing
an array it allocated itself, so it could never be hit again once that
temporary was collected, and only looked live because the key outlived the
call.
