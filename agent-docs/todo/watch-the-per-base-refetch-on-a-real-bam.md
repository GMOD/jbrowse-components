---
name: watch-the-per-base-refetch-on-a-real-bam
description: the sub-pixel bin gave the per-base modes new fetch traffic — they now refetch on a zoom-in that crosses an octave, where before they never refetched on zoom — and nobody has watched it on a real BAM
metadata:
  area: alignments, RPC
  category: measure-first
  order: 1
  first_move: "count `RenderAlignmentData` calls over a scripted zoom; don't reason about the throttle. New traffic in a mode that had none, and nobody has watched it"
---

# Watch the per-base refetch on a real BAM

`perBaseBinBp` is a call-site RPC argument resolved off the debounced
`coarseBpPerPx`, so it changes once per octave and each change is a refetch of
the region ([reference/PER_BASE_SUBPIXEL_BIN.md](../reference/PER_BASE_SUBPIXEL_BIN.md)).
Before the bin, the per-base modes refetched on pan and on a settings change and
never on zoom alone. Now a zoom-in that crosses an octave boundary is a fetch.

That is defensible on its face — the held data really is too coarse to draw at
the new zoom, which is the whole point of the bin — but it is **new traffic in a
mode that had none**, and nobody has watched it happen. The two things worth
knowing are how many refetches a normal zoom gesture actually triggers once the
600ms throttle and the debounce have both had their say, and whether latest-wins
cancels them cleanly or leaves extract work running in the worker behind a
cancelled RPC.

**First move: count the calls, don't reason about them.** The throttle and the
debounce interact in a way the code does not make obvious, so a
`RenderAlignmentData` call count over a scripted zoom on a real BAM is worth more
than any reading of `FetchVisibleRegions`. If the number is small this closes as
a note in the reference doc.

**There is a published claim on the other end of it.** The
`zoom-in-refetch` record is quoted on `website/docs/developer_guides/optimizations.md`, and its `current`
column is 0ms in every case — zoom no longer waits on a fetch. It was measured
on 2026-08-05, three weeks before the bin landed (`e3f9fb7eb4`, 2026-08-24),
and its six cases all colour by the default scheme, so the bin does not
falsify it. But per-base is now the one mode that can refetch on a zoom, and
whether the public page owes a caveat is decided by the count this entry asks
for.
