---
name: a-synteny-lane-never-finishes-loading-on-a-refname-the-file-has-no-records-for
description: chrX on the HG002 demo leaves the chain lane at "Loading..." indefinitely; find where the fetch never completes before deciding what to fix
metadata:
  area: synteny, comparative
  category: measure-first
---

# A synteny lane never finishes loading on a refName the file has no records for

Navigate a `SyntenyTrack` lane in a plain LGV to a reference sequence the
alignment file carries no records for and the lane sits at `Loading...` and
never leaves it. Not slow: a capture held it for **180 seconds** and gave up,
against the same session's ordinary fetch on an aligned contig, which is
seconds.

Reproduced on the hosted HG002 demo (`jbrowse.org/demos/hg002/config.json`),
whose Q100 maternal-to-paternal chain is the case that makes this ordinary
rather than exotic. HG002 is male, so `chrX_MATERNAL` and `chrY_PATERNAL` have
no counterpart to chain to and appear in no record in the file — two whole
chromosomes of a published dataset, and the tutorial page already tells readers
they are empty. Any user who types a chrX locus lands on it.

The A/B is one string, in `synteny_follow_unaligned`'s own session:

- `chr9_MATERNAL:60,000,000-60,070,000` — captures clean.
- `chrX_MATERNAL:60,000,000-60,070,000` — `waitForText: text still visible
  "Loading"` at a 180s timeout, and the run's `DISPLAYS NOT PAINTED AT CAPTURE`
  names `pileup-display`, which is this lane: `LGVSyntenyDisplay` is built on
  `linearAlignmentsDisplayStateModelFactory`.

**First move: find where it stops, because three candidates are all plausible
from here and the fix differs for each.** The adapter never returning for a
refName it has no index entry for; the rename/`getRefNames` path resolving to
something the adapter answers with a pending promise; or the display's own gate
never clearing when the region resolves to nothing to ask for. Log at each
boundary rather than reasoning from the symptom — a display over its gate and a
display waiting on a fetch look identical from the frame.

Attribution note: seen against a `products/jbrowse-web/build` from 2026-08-23
09:25, which **predates** that day's byte-gating changes in
`packages/core/src/rpc/byteBudget.ts` (12:26 onward; the canvas-side byte
gate it replaced is gone since). So it is
not those, and it may or may not still reproduce on a fresh build — rebuild
before attributing.

The figure that found it does not depend on the fix. `synteny_follow_unaligned`
frames the follow's unaligned state on a **gap between two chains** instead,
which is the general case the linear synteny view guide describes anyway.
