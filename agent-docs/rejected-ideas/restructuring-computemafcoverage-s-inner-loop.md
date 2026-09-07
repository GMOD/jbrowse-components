---
name: restructuring-computemafcoverage-s-inner-loop
description: Restructuring `computeMafCoverage`'s inner loop
area: performance-and-measurement
---

# Restructuring `computeMafCoverage`'s inner loop

hoisting the `refKnown`
test out of the per-cell loop (it is constant for the column) and precomputing
an `isRefRow` byte per block instead of loading `rowSample[i]` on every cell.
Output-identical, and it *looks* like free wins on the stage that is 69-74% of
the RPC's CPU on medium and deep regions. Measured against the real
implementation, both imported, 30 alternating samples: **0.99x / 1.00x / 0.89x
/ 0.90x** across four shapes. The per-block fill loop costs about what the
cheaper per-cell load saves, and on short blocks it costs more. An earlier
reading of 1.35-1.43x for the same change was the local-copy artifact
described below — the variant was local, the baseline imported. `NO_BASE`,
column-major, and the per-column accumulation are all still carrying their
own measurements.

Both stay rejected, but the *reason* they measured flat is now known and is
worth more than the rejection. Decomposing the per-cell cost
(`plugins/maf/benches/mafCoverage.bench.ts`, plus one-off kernels) showed the
loop is not ALU bound and not memory bound: gapless data with nothing to emit
still costs ~8.5ns/cell, and holding the inner loop at 447 rows while sweeping
the block footprint from 3KB to 3.5MB leaves ns/cell flat. Peeling the body one
operation at a time put the largest single item in `alignedBaseUpper`'s
`col >= len` bound test — a kernel without it is **1.8x** the one with it on
both a 26x7 and a 447x200 shape. So shaving integer ops off a loop that is
paying for a bound test is exactly the work that cannot show up. Hoisting that
test to a per-block `uniformRows` scan (every row of a MAF block spans the same
alignment columns; a shorter row is the defensive case) landed at 1.13-1.24x on
the whole function across eight shapes, controls 0.97-1.04x. The lesson
generalizes past this function: decompose before optimizing, because the rung
that costs is rarely the rung that looks expensive.
