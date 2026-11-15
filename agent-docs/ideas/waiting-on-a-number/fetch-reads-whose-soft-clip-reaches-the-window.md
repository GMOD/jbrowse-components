---
name: fetch-reads-whose-soft-clip-reaches-the-window
description: With soft clips shown, a read whose aligned part sits outside the loaded window never arrives, so a long read's kilobase tail vanishes as you pan off a breakpoint. A worker-side fetch of region ± a constant reach would bring it back; time that fetch against the plain region on short- and long-read BAM and CRAM first.
---

# Fetch reads whose soft clip reaches the window

The display fetches the viewport widened by half its width each side
(`packages/display-kit/src/regionHost.ts`), and every adapter admits a read by
its aligned overlap with that region. With **Show soft clipping** on, a read
whose aligned part lies past the loaded edge but whose clip runs back into view
is never fetched. `buildSoftclipBaseArrays` clamps the bases of the reads that
are fetched to the same region, so every tail stops at the loaded edge at once.
`alignments_track.md`'s Soft clipping section states the rule.

On short reads the margin hides it. On long reads it reads as a data bug: pan
1 kb into a deletion and every kilobase tail from the breakpoint reads vanishes
on the next refetch. Clip lengths per read end on HG002 ONT UL, 20:10-11 Mb,
6,818 ends:

| Measure                                    | Value                            |
| ------------------------------------------ | -------------------------------- |
| p90 / p95 / p99 / max                      | 102 bp / 353 bp / 8.7 kb / 270 kb |
| Share of clips ≥ 1 kb a 2 kb reach covers  | 26%                              |
| Same, 10 kb reach                          | 70%                              |
| Same, 30 kb reach                          | 89%                              |

## The shape that survived review

- In `RenderAlignmentDataRPC/executeRenderAlignmentData.ts`, when soft clips are
  shown, fetch and gate-measure `region ± SOFTCLIP_REACH_BP` in one adapter
  call, and keep reads that overlap the region or whose clipped span does.
  10 kb is v4's reach and the number to start from.
- The reach has to be a constant. "The longest clip in the first fetch" fails
  inside a deletion, where the window holds no clipped reads at all.
- The CIGAR walk emits a clip only when its junction is inside the window
  (`@gmod/bam` `mismatches.ts`), so a flank read needs a softclip-only walk over
  its own span in `shared/extractFeatureArrays.ts`.
- The clamp in `features/softclipBases/buildArrays.ts` and the reach test are
  the same intersection; one helper serves both.
- It adds a population of reads that do not overlap their region to split
  junction counts, `tables.ts` (which keeps reads by aligned overlap) and the
  chain judgement, switched by a display toggle. Each needs a decision.

Widening the display's own fetch region (v4's way) scales everything with the
region, 67x at base zoom for a 10 kb reach, and was rejected.

## The number that decides it

Fetch time and bytes for `region` against `region ± 10 kb` at 150 bp, 1.5 kb
and 15 kb viewports on `1000x.shortread.bam` and `200x.longread.bam`, BAM and
CRAM. `reference/REGION_TOO_LARGE.md`'s index estimate is flat from 1 kb to
10 kb, but that is bytes, not decode time.
