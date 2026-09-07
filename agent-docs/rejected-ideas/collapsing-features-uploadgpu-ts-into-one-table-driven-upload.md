---
name: collapsing-features-uploadgpu-ts-into-one-table-driven-upload
description: Collapsing `features/*/uploadGpu.ts` into one table-driven upload
area: rendering-and-displays
---

# Collapsing `features/*/uploadGpu.ts` into one table-driven upload

—
declined twice, then **overturned**, and how the decline went wrong is the
useful part. The standing argument was that the 16 wrappers hold the per-pass
instance count and it is *not derivable from the buffer*: `gapPositions.length
/ 2`, `mismatchPositions.length`, `numInsertions`, `coverageGpuBinCount`
(bin-capped, so decoupled from `coverageDepths.length`). A wrong count is a
silent GPU mis-render — no throw, no test failure, geometry read off the end.

**That premise was false, and the entry contained its own refutation.** The
counts are not derivable from any *other array*, but they are exactly derivable
from the *buffer*, because every packer allocates `n * INSTANCE_STRIDE_BYTES`
from the same `n`. So `buf.byteLength / pass.instanceStride` is the count, for
all 17 passes. The entry even cited `curvedArcCount` as proof the wrappers were
needed — "a second subtraction that agreed with the packer was not good enough"
— which argues for **zero** statements of the count, not two with a comment
between them. Read a "not derivable" claim as naming what it was derived
*from*: swapping the source silently swaps the claim.

**What landed instead** (`InstancePass`): the pass descriptor carries its own
packer, `uploadPass` takes the count off the bytes, and the wrappers, counts
and `if (n > 0)` guards are gone — 776 lines, 17 files. The one objection that
survived every round was co-location, and it is satisfied rather than traded:
the packer never leaves its feature directory, and there is no count beside it
to keep in agreement. The separate lesson from the declines predates this and
still holds — a table over layer *ids* closes a wiring gap, which is why
`GPU_PILEUP_PASS` is keyed on `PileupLayerId` rather than a flat list. See
GPU_RENDERING.md § "Keeping the two backends in parity".
