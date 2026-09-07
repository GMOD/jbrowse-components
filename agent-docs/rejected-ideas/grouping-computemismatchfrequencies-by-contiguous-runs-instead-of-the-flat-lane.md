---
name: grouping-computemismatchfrequencies-by-contiguous-runs-instead-of-the-flat-lane
description: Grouping `computeMismatchFrequencies` by contiguous runs instead of the flat lane array
area: performance-and-measurement
---

# Grouping `computeMismatchFrequencies` by contiguous runs instead of the flat lane array

measured 2026-08-16 and declined, after the same change WAS
taken for `computeSNPCoverage` next door. The mismatches arrive ascending
(`buildMismatchArrays` sorts), so the entries at one position are contiguous
and five scratch counters would replace the span pass, the lane array and the
rare-base Map with nothing. It loses the two rows that matter:
`benches/coverageFrequencies.bench.ts`, controls 0.94-1.02, run-walk against
the shipped lane array reads **0.81x on longread-dense** (400k mismatches over
200k positions) and **0.68x on with-iupac**.

The reason is run LENGTH and what the function EMITS. Runs of two make the
run-boundary compare and the second walk of each run cost more than one
indexed bump, and the lane array is already sized by the mismatches' span
rather than by the region, so there is no window-sized allocation left to
delete. `computeSNPCoverage` is the opposite on both counts — its array was
`windowLength * 5`, and it emits one record per POSITION rather than one per
mismatch, so the run structure is work it needs anyway. "The same shape helped
the neighbouring function" is not transferable; what transfers is whether the
allocation tracks the region and whether the output is per group or per entry.
