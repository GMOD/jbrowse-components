# Handoff: split-read arc/bezier inversion endpoints

**Status:** open, not started. Investigation complete; implementation pending.

**Symptom.** In the docs screenshot "Long reads: simple inversion BAM linked +
arcs" the split-read arcs go "all over the place" instead of cleanly joining the
inversion breakpoint.

For a split long read whose segments are `a1──►a2` (fwd) and `b1◄──b2` (rev),
where the read traverses `a1→a2→b2→b1`, the junction is between **a2 (`a.end`)**
and **b2 (`b.end`)**. The arc should connect `a2↔b2`. Today it connects
`a.end → b.start` = `a2 → b1`, landing on the far edge of the reverse segment.

## Root cause

Two independent bugs, both present in the arcs path and the bezier path.

### Bug 1 — endpoint selection ignores strand

The split-read junction endpoint is chosen without regard to each segment's
strand, so it's only correct when both segments are forward.

- **Arcs** `plugins/alignments/src/features/arcs/compute.ts`
  - `chainArcs` (on-screen split segments — the case the screenshot hits): the
    non-paired branch hardcodes `p1Bp = end1`, `p2Bp = start2` (around lines
    445–449).
  - `splitArcsFromSA` (off-screen supplementary via SA tag, single-entry +
    `drawLongRange`): hardcodes `p1Bp = a1.end`, `p2Bp = a2.start` (lines
    398–408).
- **Bezier** `plugins/alignments/src/features/linkedReads/compute.ts`
  - `connectionBp` (lines 33–44) — the comment states the (wrong) intent
    explicitly:
    ```js
    // For split reads: always the inner junction edge (end for e1, start for
    // e2), regardless of strand
    if (!hasPaired) {
      return isSecond ? start : end
    }
    ```

### Bug 2 — segments chained in genomic order, not read order

Both `groupReadsByName` implementations (one in each `compute.ts`) push entries
in region-index then read-index order, i.e. roughly genomic order. Read order ≠
genomic order for inversions/translocations, so consecutive-pair chaining can
join the wrong two segments. Even the simple 2-segment inversion mis-pairs when
the read's first segment maps to the higher genomic coordinate.

## Canonical correct logic (breakpoint-split-view — copy this)

`plugins/breakpoint-split-view/src/BreakpointSplitView/components/AlignmentConnections.tsx:78-80`
(`LEFT=0`/`RIGHT=2` are start/end indices into the `LayoutRecord`):

```js
const p1 = c1[s1 === -1 ? LEFT : RIGHT]        // first segment trailing edge
const sn2 = s2 === -1
const p2 = hasPaired ? c2[sn2 ? LEFT : RIGHT]  // paired: mate 3' end
                     : c2[sn2 ? RIGHT : LEFT]  // split:  next segment leading edge
```

Reduced to bp rules:

- **First endpoint** (both paired and split): `s1 === -1 ? start : end`
  — the segment's read-trailing (3') edge.
- **Second endpoint, paired:** `s2 === -1 ? start : end` (mate 3' end).
- **Second endpoint, split:** `s2 === -1 ? end : start` (next segment's
  read-leading 5' edge).

Verify against the inversion: a1 fwd → `a.end` (a2); b rev → `b.end` (b2).
Connects a2↔b2. ✓

**Ordering:** breakpoint-split-view sorts each match chunk by
`clipLengthAtStartOfRead` before chaining
(`plugins/breakpoint-split-view/src/BreakpointSplitView/model.ts:332-339`).
That value is the soft/hard-clip length at the start of the read in 5'→3' read
coordinates — `getClip(cigar, strand)` from `@jbrowse/cigar-utils`
(`packages/cigar-utils/src/mismatchParser.ts:164`). It is the true read-order
sort key. `featurizeSA` already computes it per SA entry as
`clipLengthAtStartOfRead` (same file, line ~225).

## Implementation plan (complete solution)

### 1. Expose per-read clip-at-start-of-read from the worker

Read order can't be reconstructed on the main thread because `PileupDataResult`
carries no CIGAR. Add a per-read clip array.

- `plugins/alignments/src/shared/extractFeatureArrays.ts`: in the per-read loop
  (where `suppAlignments` is pushed, ~line 85), compute
  `getClip(feature.get('CIGAR'), strand)` and collect into a `clipAtStart:
  number[]`. Reads without a CIGAR (synteny features) push `0`. Return it.
- `plugins/alignments/src/shared/buildBaseReadArrays.ts` OR the result assembly
  in `RenderAlignmentDataRPC/executeRenderAlignmentData.ts` (~line 288, next to
  `readNextPositions`/`readSuppAlignments`): emit
  `readClipAtStart: Uint32Array`.
- `plugins/alignments/src/RenderAlignmentDataRPC/types.ts`: add
  `readClipAtStart?: Uint32Array` to `PileupDataResult` (near
  `readNextPositions`, line ~281).
- This is a **fetch-result derivative**, NOT an `rpcProps`/tier-1 input — it's
  produced by the worker and consumed on the main thread. Do not add it to
  `rpcProps()`. See `LinearAlignmentsDisplay/CLAUDE.md`.

### 2. Shared endpoint helper (so arcs + bezier can't drift)

Add one helper (suggest `plugins/alignments/src/shared/splitReadEndpoints.ts`)
implementing the breakpoint-split-view rule:

```ts
// trailing (3') edge of a segment in read coordinates
export function readTrailingBp(strand: number, start: number, end: number) {
  return strand === -1 ? start : end
}
// leading (5') edge of the next segment in read coordinates
export function readLeadingBp(strand: number, start: number, end: number) {
  return strand === -1 ? end : start
}
```

Paired second endpoint stays `strand === -1 ? start : end` (= `readTrailingBp`,
mate 3' end). Split second endpoint is `readLeadingBp`.

### 3. Arcs — `features/arcs/compute.ts`

- `chainArcs`: sort `filtered` by `readClipAtStart` BEFORE the consecutive-pair
  loop (only meaningful for the split / non-paired case; paired keeps current
  behavior). Replace the hardcoded edges:
  - `p1Bp = hasPaired ? readTrailingBp(s1,…) : readTrailingBp(s1,…)` (same)
  - `p2Bp = hasPaired ? readTrailingBp(s2,…) : readLeadingBp(s2,…)`
- `splitArcsFromSA`: build the `allAlns` list (primary + parsed SA), then sort by
  clip-at-start-of-read. Primary clip = `readClipAtStart[readIdx]`; each SA
  entry's clip = `getClip(saCigar, effectiveStrand)` (parse it in `parseSATag`,
  which currently discards everything but `lengthOnRef` — add a `clip` field).
  Then chain with `readTrailingBp`/`readLeadingBp`.

Watch: `parseSATag` strand is the SA's own strand; for clip ordering use the SA
strand relative to the primary the way `featurizeSA`'s `effectiveStrand` does
(normalize against the primary strand). Mirror `featurizeSA` rather than
reinventing.

### 4. Bezier — `features/linkedReads/compute.ts`

- `connectionBp`: split branch becomes
  `isSecond ? readLeadingBp(strand,start,end) : readTrailingBp(strand,start,end)`;
  paired branch unchanged (`readTrailingBp`).
- `iterLinkedPairs` / `groupReadsByName`: sort each name-group's `filtered`
  entries by `readClipAtStart` before the consecutive-pair loop (split case).
  `classifyPair` already reads strands correctly; only ordering + `connectionBp`
  change.
- `splitColorType` (inv vs normal coloring) already uses `s1`/`s2` and needs no
  change.

### 5. Tests

- `features/arcs` and `features/linkedReads/computeOverlay.test.ts` have existing
  fixtures — add an inversion fixture (two segments, one rev) and assert the
  arc/curve connects the two inner-by-read-order edges (a2↔b2), not a2↔b1.
- Add a 3-segment / genomically-out-of-order case to lock in the clip-sort.
- breakpoint-split-view `util.test.ts` is the reference for expected geometry.

### 6. Verify

Re-render the "Long reads: simple inversion BAM linked + arcs" screenshot
against the local build (see memory `screenshots-render-local-build` —
must load bare `?config=`, not jb2/latest). Arcs should form clean domes joining
each inversion breakpoint.

## Files touched (summary)

- `packages/cigar-utils/src/mismatchParser.ts` — reuse `getClip` (no change)
- `plugins/alignments/src/shared/extractFeatureArrays.ts` — collect clip
- `plugins/alignments/src/shared/buildBaseReadArrays.ts` or
  `RenderAlignmentDataRPC/executeRenderAlignmentData.ts` — emit `readClipAtStart`
- `plugins/alignments/src/RenderAlignmentDataRPC/types.ts` — type field
- `plugins/alignments/src/shared/splitReadEndpoints.ts` — NEW shared helper
- `plugins/alignments/src/features/arcs/compute.ts` — sort + endpoints
- `plugins/alignments/src/features/linkedReads/compute.ts` — sort + `connectionBp`
- tests in `features/arcs`, `features/linkedReads`
